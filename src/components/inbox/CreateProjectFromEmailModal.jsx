import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DraftProjectForm from "./DraftProjectForm";
import ProjectForm from "../projects/ProjectForm";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draftSubmitted, setDraftSubmitted] = useState(false);
  const [draftData, setDraftData] = useState(null);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('manageProject', { 
        action: 'create', 
        data: {
          ...data,
          source_email_thread_id: thread.id
        }
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.project;
    },
    onSuccess: async (newProject) => {
      try {
        // Explicitly link thread to project via EmailThread.project_id
        await base44.entities.EmailThread.update(thread.id, {
          project_id: newProject.id,
          linked_to_project_at: new Date().toISOString(),
          linked_to_project_by: (await base44.auth.me()).email
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
        
        toast.success(`Project created and linked to email`);
        onSuccess(newProject.id, newProject.title);
        onClose();
        
        // Navigate to the new project
        navigate(`${createPageUrl("Projects")}?projectId=${newProject.id}`);
      } catch (error) {
        toast.error(`Failed to link project: ${error.message}`);
        // Project was created but linking failed - still navigate
        navigate(`${createPageUrl("Projects")}?projectId=${newProject.id}`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    }
  });

  const handleDraftSubmit = (draftFormData) => {
    setDraftData(draftFormData);
    setDraftSubmitted(true);
  };

  const handleDraftCancel = () => {
    setDraftSubmitted(false);
    setDraftData(null);
  };

  const handleConfirmCreate = (fullProjectData) => {
    createProjectMutation.mutate(fullProjectData);
  };

  if (!thread) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <DialogTitle className="text-[22px] font-semibold">
            {draftSubmitted ? 'Confirm Project Details' : 'Create Project from Email'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {!draftSubmitted ? (
            // Draft Form - minimal, AI-filled fields highlighted
            <DraftProjectForm
              thread={thread}
              onConfirm={handleDraftSubmit}
              onCancel={onClose}
              isSubmitting={false}
            />
          ) : (
            // Full Form - confirm and edit before creating
            <ProjectForm
              initialData={{
                ...draftData,
                customer_id: "",
                customer_name: "",
                customer_email: "",
                customer_phone: "",
                status: "Lead"
              }}
              onSubmit={handleConfirmCreate}
              onCancel={handleDraftCancel}
              isSubmitting={createProjectMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}