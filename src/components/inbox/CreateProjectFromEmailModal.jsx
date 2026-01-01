import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "../projects/ProjectForm";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open
  });

  const initialData = useMemo(() => {
    if (!thread) return null;

    const aiSuggested = thread.ai_suggested_project_fields || {};
    const emailAddress = (aiSuggested.suggested_customer_email || thread.from_address || "").toLowerCase().trim();
    const customerName = aiSuggested.suggested_customer_name || "";
    const customerPhone = aiSuggested.suggested_customer_phone || "";

    // Find existing customer by email
    const existingCustomer = customers.find(c => 
      c.email?.toLowerCase().trim() === emailAddress && !c.deleted_at
    );

    return {
      title: aiSuggested.suggested_title || thread.subject || "",
      customer_id: existingCustomer?.id || "",
      customer_name: customerName,
      customer_email: emailAddress,
      customer_phone: customerPhone,
      project_type: aiSuggested.suggested_project_type || "Garage Door Install",
      status: "Lead",
      description: aiSuggested.suggested_description || thread.last_message_snippet || "",
      address_full: aiSuggested.suggested_address || "",
      notes: `Created from email: ${thread.from_address}\n\n${thread.subject}`
    };
  }, [thread?.id, customers]);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('manageProject', { 
        action: 'create', 
        data 
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.project;
    },
    onSuccess: async (newProject) => {
      // Link the email thread to the new project
      await base44.entities.EmailThread.update(thread.id, {
        linked_project_id: newProject.id,
        linked_project_title: newProject.title
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
      
      onSuccess(newProject.id, newProject.title);
      onClose();
      
      // Navigate to the new project
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