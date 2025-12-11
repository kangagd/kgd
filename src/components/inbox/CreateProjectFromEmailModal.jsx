import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "../projects/ProjectForm";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  const [initialData, setInitialData] = useState(null);
  const [isPreparingCustomer, setIsPreparingCustomer] = useState(false);
  const hasProcessedRef = useRef(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open
  });

  useEffect(() => {
    if (!open || !thread) {
      setInitialData(null);
      hasProcessedRef.current = false;
      return;
    }

    if (hasProcessedRef.current) {
      return;
    }

    if (customers.length === 0) {
      return;
    }

    const prepareProjectData = async () => {
      hasProcessedRef.current = true;
      setIsPreparingCustomer(true);
      
      const aiSuggested = thread.ai_suggested_project_fields || {};
      const emailAddress = (aiSuggested.suggested_customer_email || thread.from_address || "").toLowerCase().trim();
      const customerName = aiSuggested.suggested_customer_name || "";
      const customerPhone = aiSuggested.suggested_customer_phone || "";

      let customerId = "";

      // Check if customer exists by email
      if (emailAddress) {
        const existingCustomer = customers.find(c => 
          c.email?.toLowerCase().trim() === emailAddress && !c.deleted_at
        );

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else if (customerName) {
          // Create new customer automatically
          try {
            const newCustomer = await base44.entities.Customer.create({
              name: customerName,
              email: emailAddress,
              phone: customerPhone,
              status: "active"
            });
            customerId = newCustomer.id;
            queryClient.invalidateQueries({ queryKey: ['customers'] });
          } catch (error) {
            console.error("Error creating customer:", error);
          }
        }
      }

      setInitialData({
        title: aiSuggested.suggested_title || thread.subject || "",
        customer_id: customerId,
        customer_name: customerName,
        customer_email: emailAddress,
        customer_phone: customerPhone,
        project_type: aiSuggested.suggested_project_type || "Garage Door Install",
        status: "Lead",
        description: aiSuggested.suggested_description || thread.last_message_snippet || "",
        address_full: aiSuggested.suggested_address || "",
        notes: `Created from email: ${thread.from_address}\n\n${thread.subject}`
      });
      setIsPreparingCustomer(false);
    };

    prepareProjectData();
  }, [open, thread?.id, customers.length > 0]);

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

  if (!initialData || isPreparingCustomer) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-[22px] font-semibold">Create Project from Email</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-[#6B7280]">Preparing project data...</p>
        </div>
      </DialogContent>
    </Dialog>
  );

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