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
        status: 'scheduled'
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
      <DialogContent className="sm:max-w-lg border-2 border-slate-300 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b-2 border-slate-200">
          <DialogTitle className="text-2xl font-bold text-[#000000] tracking-tight">Quick Book Job</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="font-bold text-[#000000]">Date</Label>
            <Input
              type="text"
              value={selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
              disabled
              className="bg-slate-100 border-2 border-slate-300 font-semibold h-12"
            />
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId} required>
              <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id} className="font-semibold">
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Job Type *</Label>
            <Select value={jobTypeId} onValueChange={setJobTypeId} required>
              <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold">
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map(jobType => (
                  <SelectItem key={jobType.id} value={jobType.id} className="font-semibold">
                    {jobType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Time *</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
            />
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Assign Technician</Label>
            <Select value={assignedTo[0] || ""} onValueChange={(val) => setAssignedTo([val])}>
              <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.email} value={tech.email} className="font-semibold">
                    {tech.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleFullForm}
              className="flex-1 h-12 font-semibold border-2"
            >
              Full Form
            </Button>
            <Button
              type="submit"
              disabled={createJobMutation.isPending}
              className="flex-1 h-12 bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {createJobMutation.isPending ? 'Booking...' : 'Book Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}