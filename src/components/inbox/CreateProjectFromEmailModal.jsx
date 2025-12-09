import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROJECT_TYPE_OPTIONS } from "@/components/domain/projectConfig";

export default function CreateProjectFromEmailModal({ open, onClose, thread, onSuccess }) {
  const aiSuggested = thread?.ai_suggested_project_fields || {};
  
  const [formData, setFormData] = useState({
    title: aiSuggested.suggested_title || thread?.subject || "",
    customer_id: "",
    customer_name: aiSuggested.suggested_customer_name || "",
    customer_email: aiSuggested.suggested_customer_email || "",
    customer_phone: aiSuggested.suggested_customer_phone || "",
    project_type: aiSuggested.suggested_project_type || "Garage Door Install",
    status: "Lead",
    description: aiSuggested.suggested_description || thread?.last_message_snippet || "",
    address_full: aiSuggested.suggested_address || "",
    notes: `Created from email: ${thread?.from_address}\n\n${thread?.subject}`
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: (newProject) => {
      onSuccess(newProject.id, newProject.title);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === formData.customer_id);
    const projectData = {
      ...formData,
      customer_name: customer?.name || formData.customer_name,
      customer_phone: customer?.phone || formData.customer_phone,
      customer_email: customer?.email || formData.customer_email
    };
    createProjectMutation.mutate(projectData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project from Email</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.filter(c => !c.deleted_at).map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone && `• ${customer.phone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.customer_name && !formData.customer_id && (
              <p className="text-xs text-[#6B7280] bg-[#FEF3C7] border border-[#FCD34D] rounded px-2 py-1">
                AI suggested: {formData.customer_name}
                {formData.customer_phone && ` • ${formData.customer_phone}`}
                {formData.customer_email && ` • ${formData.customer_email}`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Project Type *</Label>
            <Select
              value={formData.project_type}
              onValueChange={(value) => setFormData({ ...formData, project_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {formData.address_full && (
            <div className="space-y-2">
              <Label>Address (AI Suggested)</Label>
              <Input
                value={formData.address_full}
                onChange={(e) => setFormData({ ...formData, address_full: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}