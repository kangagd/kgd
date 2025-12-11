import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "../projects/ProjectForm";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  
  // Compute initial data once from thread
  const initialData = useMemo(() => {
    if (!thread) return null;
    const aiSuggested = thread.ai_suggested_project_fields || {};
    return {
      title: aiSuggested.suggested_title || thread.subject || "",
      customer_id: "",
      customer_name: aiSuggested.suggested_customer_name || "",
      customer_email: aiSuggested.suggested_customer_email || thread.from_address || "",
      customer_phone: aiSuggested.suggested_customer_phone || "",
      project_type: aiSuggested.suggested_project_type || "Garage Door Install",
      status: "Lead",
      description: aiSuggested.suggested_description || thread.last_message_snippet || "",
      address_full: aiSuggested.suggested_address || "",
      notes: `Created from email: ${thread.from_address}\n\n${thread.subject}`
    };
  }, [thread?.id]);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('manageProject', { 
        action: 'create', 
        data 
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.project;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess(newProject.id, newProject.title);
      onClose();
    }
  });

  const handleSubmit = (data) => {
    createProjectMutation.mutate(data);
  };

  if (!initialData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-[22px] font-semibold">Create Project from Email</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          <ProjectForm
            project={initialData}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSubmitting={createProjectMutation.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}