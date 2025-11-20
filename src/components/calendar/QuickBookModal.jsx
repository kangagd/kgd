import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";

export default function QuickBookModal({ open, onClose, selectedDate }) {
  const [customerId, setCustomerId] = useState("");
  const [jobTypeId, setJobTypeId] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [assignedTo, setAssignedTo] = useState([]);
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }),
    enabled: open
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.filter({ is_active: true }),
    enabled: open
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: open
  });

  const createJobMutation = useMutation({
    mutationFn: async (data) => {
      const customer = customers.find(c => c.id === customerId);
      const jobType = jobTypes.find(jt => jt.id === jobTypeId);
      
      const jobData = {
        customer_id: customerId,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        customer_email: customer?.email,
        customer_type: customer?.customer_type,
        address: customer?.address || "",
        scheduled_date: format(selectedDate || new Date(), 'yyyy-MM-dd'),
        scheduled_time: scheduledTime,
        job_type_id: jobTypeId,
        job_type_name: jobType?.name,
        expected_duration: jobType?.estimated_duration,
        assigned_to: assignedTo,
        assigned_to_name: assignedTo.map(email => {
          const tech = technicians.find(t => t.email === email);
          return tech?.full_name;
        }).filter(Boolean),
        job_status: 'Scheduled'
      };

      return base44.entities.Job.create(jobData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      handleClose();
    }
  });

  const handleClose = () => {
    setCustomerId("");
    setJobTypeId("");
    setScheduledTime("");
    setAssignedTo([]);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createJobMutation.mutate();
  };

  const handleFullForm = () => {
    handleClose();
    window.location.href = createPageUrl('Jobs') + '?action=new';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Book Job</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Date</Label>
            <Input
              type="text"
              value={selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
              disabled
              className="bg-slate-50"
            />
          </div>

          <div>
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Job Type *</Label>
            <Select value={jobTypeId} onValueChange={setJobTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map(jobType => (
                  <SelectItem key={jobType.id} value={jobType.id}>
                    {jobType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Time *</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Assign Technicians</Label>
            <Select value={assignedTo[0] || ""} onValueChange={(val) => setAssignedTo([val])}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.email} value={tech.email}>
                    {tech.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleFullForm}
              className="flex-1"
            >
              Full Form
            </Button>
            <Button
              type="submit"
              disabled={createJobMutation.isPending}
              className="flex-1 bg-[#fae008] text-slate-950 hover:bg-[#fae008]/90"
            >
              {createJobMutation.isPending ? 'Booking...' : 'Book Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}