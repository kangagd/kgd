import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "../projects/ProjectForm";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export default function ProjectFromEmailDraftModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open
  });

  const initialData = useMemo(() => {
    if (!thread) return null;

    // Map AI data to project fields
    const aiFilledFields = {
      title: thread.ai_overview ? 
        thread.subject || "" : 
        thread.subject || "",
      description: thread.ai_overview || thread.last_message_snippet || "",
      project_type: thread.ai_category ? mapCategoryToProjectType(thread.ai_category) : "Garage Door Install"
    };

    const emailAddress = (thread.from_address || "").toLowerCase().trim();
    const existingCustomer = customers.find(c => 
      c.email?.toLowerCase().trim() === emailAddress && !c.deleted_at
    );

    return {
      title: aiFilledFields.title,
      customer_id: existingCustomer?.id || "",
      customer_name: existingCustomer?.name || "",
      customer_email: emailAddress,
      customer_phone: existingCustomer?.phone || "",
      project_type: aiFilledFields.project_type,
      status: "Lead",
      description: aiFilledFields.description,
      address_full: existingCustomer?.address_full || "",
      notes: `Created from email: ${thread.from_address}\n\nSubject: ${thread.subject}`,
      // Track which fields were AI-filled for visual highlighting
      _aiFilledFields: {
        title: !!thread.subject,
        description: !!thread.ai_overview,
        project_type: !!thread.ai_category
      },
      // Reference email thread as source
      source_email_thread_id: thread.id
    };
  }, [thread?.id, customers]);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      // Remove meta fields before API call
      const { _aiFilledFields, source_email_thread_id, ...projectData } = data;
      
      const response = await base44.functions.invoke('manageProject', { 
        action: 'create', 
        data: {
          ...projectData,
          source_email_thread_id // Include thread reference
        }
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.project;
    },
    onSuccess: async (newProject) => {
      // Link email thread to new project
      await base44.functions.invoke('linkEmailThreadToProject', {
        email_thread_id: thread.id,
        project_id: newProject.id,
        set_as_primary: true
      });

      // Update thread linking state (no auto-link, explicit action)
      await base44.entities.EmailThread.update(thread.id, {
        project_id: newProject.id,
        linked_to_project_at: new Date().toISOString(),
        linked_to_project_by: (await base44.auth.me())?.email
      });

      // Create ProjectEmail record for activity timeline
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
      
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      queryClient.invalidateQueries({ queryKey: ['project', newProject.id] });
      queryClient.invalidateQueries({ queryKey: ['emailThread', thread.id] });
      
      onSuccess(newProject.id, newProject.title);
      onClose();
      navigate(`${createPageUrl("Projects")}?projectId=${newProject.id}`);
    }
  });

  const handleSubmit = (data) => {
    createProjectMutation.mutate(data);
  };

  if (!initialData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-[22px] font-semibold flex items-center gap-2">
              Create Project from Email
              <Badge variant="default" className="bg-[#FAE008] text-[#111827] flex items-center gap-1 ml-2">
                <Sparkles className="w-3 h-3" />
                AI Draft
              </Badge>
            </DialogTitle>
            <p className="text-sm text-slate-600 mt-1">Fields highlighted in yellow were filled by AI. Review and edit as needed.</p>
          </div>
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