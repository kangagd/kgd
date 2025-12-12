import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CreateJobFromEmailModal({ open, onClose, thread, onSuccess }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customer_id: "",
    address: "",
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: "",
    status: "Open",
    notes: `Created from email: ${thread?.from_address}\n\n${thread?.subject}\n\n${thread?.last_message_snippet || ""}`
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true })
  });

  const { data: existingJobs = [] } = useQuery({
    queryKey: ['jobNumbers'],
    queryFn: () => base44.entities.Job.list()
  });

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      // Get next job number
      const jobNumbers = existingJobs.map(j => j.job_number).filter(n => n);
      const nextJobNumber = jobNumbers.length > 0 ? Math.max(...jobNumbers) + 1 : 5000;
      
      return base44.entities.Job.create({ ...data, job_number: nextJobNumber });
    },
    onSuccess: async (newJob) => {
      // Link the email thread to the new job
      await base44.entities.EmailThread.update(thread.id, {
        linked_job_id: newJob.id,
        linked_job_number: newJob.job_number
      });
      
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      
      onSuccess(newJob.id, newJob.job_number);
      onClose();
      
      // Navigate to the new job
      navigate(`${createPageUrl("Jobs")}?jobId=${newJob.id}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === formData.customer_id);
    const jobData = {
      ...formData,
      customer_name: customer?.name,
      customer_phone: customer?.phone,
      customer_email: customer?.email
    };
    createJobMutation.mutate(jobData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job from Email</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          <div className="space-y-2">
            <Label>Address *</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scheduled Date *</Label>
              <Input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Scheduled Time</Label>
              <Input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job Type</Label>
            <Select
              value={formData.job_type_id}
              onValueChange={(value) => {
                const jobType = jobTypes.find(jt => jt.id === value);
                setFormData({
                  ...formData,
                  job_type_id: value,
                  job_type_name: jobType?.name
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={5}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
              disabled={createJobMutation.isPending}
            >
              {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}