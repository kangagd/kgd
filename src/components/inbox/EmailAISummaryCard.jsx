import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, FolderPlus, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function EmailAISummaryCard({ thread, onThreadUpdate, onCreateProject }) {
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

  return (
    <Card className="border border-[#E0E7FF] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#6366F1]" />
            </div>
            <div>
              <span className="text-[13px] font-semibold text-[#4338CA]">AI Summary</span>
              {thread.ai_analyzed_at && (
                <span className="text-[11px] text-[#6B7280] ml-2">
                  • {format(parseISO(thread.ai_analyzed_at), 'MMM d, h:mm a')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasInsights && onCreateProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateProject}
                className="h-8 text-[12px] border-[#6366F1]/30 text-[#4338CA] hover:bg-[#6366F1]/10 hover:border-[#6366F1]"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                Use for Project
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

        {isGenerating && !hasInsights && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
            <span className="text-[14px] text-[#4B5563]">Analyzing email thread...</span>
          </div>
        )}

        {hasInsights && (
          <>
            <p className="text-[14px] text-[#374151] leading-relaxed">
              {thread.ai_summary}
            </p>

            {thread.ai_key_points && thread.ai_key_points.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowKeyPoints(!showKeyPoints)}
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
                <p className="text-[12px] text-[#6B7280]">
                  <span className="font-medium text-[#4338CA]">Suggested:</span>
                  {thread.ai_suggested_project_fields.suggested_title && (
                    <span className="ml-1">"{thread.ai_suggested_project_fields.suggested_title}"</span>
                  )}
                  {thread.ai_suggested_project_fields.suggested_project_type && (
                    <span className="ml-1">• {thread.ai_suggested_project_fields.suggested_project_type}</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {!hasInsights && !isGenerating && (
          <p className="text-[14px] text-[#6B7280]">
            Click "Generate" to create an AI summary of this email thread.
          </p>
        )}
      </CardContent>
    </Card>
  );
}