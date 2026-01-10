import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "./ProjectForm";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

/**
 * Unified modal for project creation from any source
 * Supports pre-filling with AI data if available
 */
export default function ProjectCreationModal({ 
  open, 
  onClose, 
  thread = null, // Email thread with AI data
  onSuccess 
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open
  });

  const initialData = useMemo(() => {
    // If no thread, return basic form
    if (!thread) {
      return {
        customer_id: "",
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        title: "",
        description: "",
        project_type: "Garage Door Install",
        status: "Lead",
        financial_status: "",
        address_full: "",
        notes: "",
        _aiFilledFields: {}
      };
    }

    // Build AI-prefilled data from thread
    const aiFilledFields = {};
    const aiData = {};

    // Title from subject
    if (thread.subject) {
      aiData.title = thread.subject;
      aiFilledFields.title = true;
    }

    // Description from AI overview or snippet
    if (thread.ai_overview) {
      aiData.description = thread.ai_overview;
      aiFilledFields.description = true;
    } else if (thread.last_message_snippet) {
      aiData.description = thread.last_message_snippet;
    }

    // Project type from AI category
    if (thread.ai_category) {
      aiData.project_type = mapCategoryToProjectType(thread.ai_category);
      aiFilledFields.project_type = true;
    } else {
      aiData.project_type = "Garage Door Install";
    }

    // Try to match customer by email
    const emailAddress = (thread.from_address || "").toLowerCase().trim();
    const existingCustomer = customers.find(c => 
      c.email?.toLowerCase().trim() === emailAddress && !c.deleted_at
    );

    return {
      customer_id: existingCustomer?.id || "",
      customer_name: existingCustomer?.name || "",
      customer_email: emailAddress,
      customer_phone: existingCustomer?.phone || "",
      title: aiData.title || "",
      description: aiData.description || "",
      project_type: aiData.project_type,
      status: "Lead",
      financial_status: "",
      address_full: existingCustomer?.address_full || "",
      notes: `Created from email: ${thread.from_address}\n\nSubject: ${thread.subject}`,
      _aiFilledFields: aiFilledFields,
      source_email_thread_id: thread.id
    };
  }, [thread?.id, customers]);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const { _aiFilledFields, source_email_thread_id, ...projectData } = data;
      
      const response = await base44.functions.invoke('manageProject', { 
        action: 'create', 
        data: {
          ...projectData,
          source_email_thread_id
        }
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.project;
    },
    onSuccess: async (newProject) => {
      // If created from email thread, link them
      if (thread) {
        await base44.functions.invoke('linkEmailThreadToProject', {
          email_thread_id: thread.id,
          project_id: newProject.id,
          set_as_primary: true
        });

        await base44.entities.EmailThread.update(thread.id, {
          project_id: newProject.id,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: (await base44.auth.me())?.email
        });

        await base44.entities.ProjectEmail.create({
          project_id: newProject.id,
          thread_id: thread.gmail_thread_id || thread.id,
          gmail_message_id: thread.gmail_thread_id || thread.id,
          subject: thread.subject,
          from_email: thread.from_address,
          to_email: Array.isArray(thread.to_addresses) ? thread.to_addresses.join(', ') : thread.to_addresses,
          sent_at: thread.last_message_date || thread.created_date,
          direction: 'incoming'
        });

        queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
        queryClient.invalidateQueries({ queryKey: ['emailThread', thread.id] });
      }

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', newProject.id] });
      
      onSuccess?.(newProject.id, newProject.title);
      onClose();
      navigate(`${createPageUrl("Projects")}?projectId=${newProject.id}`);
    }
  });

  const handleSubmit = (data) => {
    createProjectMutation.mutate(data);
  };

  if (!initialData) return null;

  const hasAIData = thread && Object.keys(initialData._aiFilledFields).length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-[22px] font-semibold">Create New Project</DialogTitle>
            {hasAIData && (
              <Badge variant="default" className="bg-[#FAE008] text-[#111827] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Assisted
              </Badge>
            )}
          </div>
          {hasAIData && (
            <p className="text-sm text-slate-600 mt-2">Fields highlighted in yellow were suggested by AI. Review and edit as needed.</p>
          )}
        </DialogHeader>
        <div className="px-6 pb-6">
          <ProjectForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSubmitting={createProjectMutation.isPending}
            aiFilledFields={initialData._aiFilledFields}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Map AI category to project type
 */
function mapCategoryToProjectType(aiCategory) {
  const mapping = {
    "Quote Request": "Garage Door Install",
    "New Install": "Garage Door Install",
    "Repair/Service": "Repair",
    "Warranty": "Repair",
    "Builder Tender": "Multiple",
    "Strata/Real Estate": "Multiple"
  };
  return mapping[aiCategory] || "Garage Door Install";
}