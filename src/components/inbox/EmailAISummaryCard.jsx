import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, FolderPlus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function EmailAISummaryCard({ thread, onThreadUpdate, onCreateProject }) {
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const hasInsights = thread.ai_summary || (thread.ai_key_points && thread.ai_key_points.length > 0);

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateEmailThreadInsights', {
        email_thread_id: thread.id
      });
      
      if (response.data?.success) {
        toast.success("AI analysis complete");
        // Trigger parent to refetch thread data
        if (onThreadUpdate) {
          onThreadUpdate();
        }
      } else {
        throw new Error(response.data?.error || "Failed to generate insights");
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error(error.message || "Failed to generate AI insights");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProjectWithAI = async () => {
    if (!thread.ai_suggested_project_fields) {
      toast.error("Please generate AI insights first");
      return;
    }

    setIsCreatingProject(true);
    try {
      const suggestions = thread.ai_suggested_project_fields;
      
      // First, try to find or create the customer
      let customerId = null;
      let customerName = suggestions.suggested_customer_name || thread.from_address?.split('@')[0] || 'Unknown';
      let customerEmail = suggestions.suggested_customer_email || thread.from_address;
      let customerPhone = suggestions.suggested_customer_phone || '';

      // Check if customer exists by email
      if (customerEmail) {
        const existingCustomers = await base44.entities.Customer.filter({ email: customerEmail });
        if (existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
          customerName = existingCustomers[0].name;
          customerPhone = existingCustomers[0].phone || customerPhone;
        }
      }

      // If no customer found, create one
      if (!customerId) {
        const newCustomer = await base44.entities.Customer.create({
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address_full: suggestions.suggested_address || '',
          status: 'active'
        });
        customerId = newCustomer.id;
      }

      // Fetch email messages to get attachments
      const emailMessages = await base44.entities.EmailMessage.filter({ thread_id: thread.id });
      
      // Collect all attachments from email messages
      const imageUrls = [];
      const documentUrls = [];
      
      emailMessages.forEach(message => {
        if (message.attachments && message.attachments.length > 0) {
          message.attachments.forEach(attachment => {
            if (attachment.url) {
              const mimeType = attachment.mime_type?.toLowerCase() || '';
              const filename = attachment.filename?.toLowerCase() || '';
              
              // Check if it's an image
              if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(filename)) {
                imageUrls.push(attachment.url);
              } else {
                // It's a document
                documentUrls.push(attachment.url);
              }
            }
          });
        }
      });

      // Create the project with AI suggestions and attachments
      const projectData = {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        title: suggestions.suggested_title || thread.subject || 'New Project',
        description: suggestions.suggested_description || thread.ai_summary || '',
        project_type: suggestions.suggested_project_type || 'Repair',
        address_full: suggestions.suggested_address || '',
        status: 'Lead',
        notes: `Created from email: ${thread.from_address}\n\nAI Key Points:\n${(thread.ai_key_points || []).map(p => `• ${p}`).join('\n')}`,
        source_email_thread_id: thread.id,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        other_documents: documentUrls.length > 0 ? documentUrls : undefined
      };

      const newProject = await base44.entities.Project.create(projectData);

      // Link the email thread to the project
      await base44.entities.EmailThread.update(thread.id, {
        linked_project_id: newProject.id,
        linked_project_title: newProject.title
      });

      // Mark the AI insight as applied
      const insights = await base44.entities.AIEmailInsight.filter({ email_thread_id: thread.id });
      if (insights.length > 0) {
        await base44.entities.AIEmailInsight.update(insights[0].id, {
          project_id: newProject.id,
          applied_to_project: true,
          applied_at: new Date().toISOString()
        });
      }

      toast.success("Project created with AI suggestions");
      
      if (onThreadUpdate) {
        onThreadUpdate();
      }

      // Navigate to the new project
      window.location.href = `/Projects?projectId=${newProject.id}&fromEmail=${thread.id}`;
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <Card className="border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] shadow-sm mb-4">
      <CardContent className="p-4">
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6366F1]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#4338CA]">AI Summary</span>
              {thread.ai_analyzed_at && (
                <span className="text-[11px] text-[#6B7280]">
                  • {format(parseISO(thread.ai_analyzed_at), 'MMM d, h:mm a')}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#6366F1]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6366F1]" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {hasInsights && onCreateProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateProjectWithAI}
                disabled={isCreatingProject}
                className="h-8 text-[12px] border-[#6366F1]/30 text-[#4338CA] hover:bg-[#6366F1]/10 hover:border-[#6366F1]"
              >
                {isCreatingProject ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isCreatingProject ? "Creating..." : "Use for Project"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              className="h-8 text-[12px] border-[#6366F1]/30 text-[#4338CA] hover:bg-[#6366F1]/10 hover:border-[#6366F1]"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {hasInsights ? "Refresh" : "Generate"}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <>
            {isGenerating && !hasInsights && (
              <div className="flex items-center gap-3 py-4 mt-3">
                <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
                <span className="text-[14px] text-[#4B5563]">Analyzing email thread...</span>
              </div>
            )}

            {hasInsights && (
              <div className="mt-3">
                {/* Summary as bullet points */}
                <ul className="space-y-1.5 pl-1">
                  {thread.ai_summary?.split(/[.!?]+/).filter(s => s.trim()).map((sentence, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[14px] text-[#374151]">
                      <span className="text-[#6366F1] mt-1">•</span>
                      <span>{sentence.trim()}</span>
                    </li>
                  ))}
                </ul>

                {thread.ai_key_points && thread.ai_key_points.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowKeyPoints(!showKeyPoints); }}
                      className="flex items-center gap-1.5 text-[13px] font-medium text-[#4338CA] hover:text-[#3730A3] transition-colors"
                    >
                      {showKeyPoints ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      View key points ({thread.ai_key_points.length})
                    </button>

                    {showKeyPoints && (
                      <ul className="mt-2 space-y-1.5 pl-1">
                        {thread.ai_key_points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[13px] text-[#4B5563]">
                            <span className="text-[#6366F1] mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {thread.ai_suggested_project_fields && (
                  <div className="mt-3 pt-3 border-t border-[#E0E7FF]">
                    <ul className="space-y-1 pl-1">
                      {thread.ai_suggested_project_fields.suggested_title && (
                        <li className="flex items-start gap-2 text-[12px] text-[#6B7280]">
                          <span className="text-[#4338CA]">•</span>
                          <span><span className="font-medium">Title:</span> {thread.ai_suggested_project_fields.suggested_title}</span>
                        </li>
                      )}
                      {thread.ai_suggested_project_fields.suggested_project_type && (
                        <li className="flex items-start gap-2 text-[12px] text-[#6B7280]">
                          <span className="text-[#4338CA]">•</span>
                          <span><span className="font-medium">Type:</span> {thread.ai_suggested_project_fields.suggested_project_type}</span>
                        </li>
                      )}
                      {thread.ai_suggested_project_fields.suggested_customer_name && (
                        <li className="flex items-start gap-2 text-[12px] text-[#6B7280]">
                          <span className="text-[#4338CA]">•</span>
                          <span><span className="font-medium">Customer:</span> {thread.ai_suggested_project_fields.suggested_customer_name}</span>
                        </li>
                      )}
                      {thread.ai_suggested_project_fields.suggested_address && (
                        <li className="flex items-start gap-2 text-[12px] text-[#6B7280]">
                          <span className="text-[#4338CA]">•</span>
                          <span><span className="font-medium">Address:</span> {thread.ai_suggested_project_fields.suggested_address}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!hasInsights && !isGenerating && (
              <p className="text-[14px] text-[#6B7280] mt-3">
                Click "Generate" to create an AI summary of this email thread.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}