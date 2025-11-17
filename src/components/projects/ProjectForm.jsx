
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ProjectForm({ project, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(project || {
    name: "",
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address: "",
    project_type: "Installation",
    status: "in_progress",
    stage: "measure",
    assigned_technicians: [],
    assigned_technicians_names: [],
    description: "",
    notes: "",
    start_date: new Date().toISOString().split('T')[0],
    target_completion_date: ""
  });

  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    customer_type: "Owner"
  });

  const queryClient = useQueryClient();

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const customers = allCustomers.filter(c => c.status === 'active' && !c.deleted_at);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: async (newCustomer) => {
      await queryClient.refetchQueries({ queryKey: ['customers'] });
      setFormData({
        ...formData,
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
        customer_email: newCustomer.email || ""
      });
      setShowNewCustomerDialog(false);
      setNewCustomerData({
        name: "",
        phone: "",
        email: "",
        customer_type: "Owner"
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || "",
      customer_phone: customer?.phone || "",
      customer_email: customer?.email || "",
      address: customer?.address || formData.address
    });
  };

  const handleTechnicianToggle = (techEmail) => {
    const tech = technicians.find(t => t.email === techEmail);
    const currentTechs = formData.assigned_technicians || [];
    const currentNames = formData.assigned_technicians_names || [];
    
    if (currentTechs.includes(techEmail)) {
      setFormData({
        ...formData,
        assigned_technicians: currentTechs.filter(e => e !== techEmail),
        assigned_technicians_names: currentNames.filter(n => n !== tech?.full_name)
      });
    } else {
      setFormData({
        ...formData,
        assigned_technicians: [...currentTechs, techEmail],
        assigned_technicians_names: [...currentNames, tech?.full_name]
      });
    }
  };

  const handleCreateCustomer = () => {
    createCustomerMutation.mutate({
      ...newCustomerData,
      status: "active"
    });
  };

  return (
    <>
      <Card className="max-w-3xl mx-auto m-6 border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCancel}
              className="hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
              {project ? 'Edit Project' : 'Create New Project'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Garage Door Installation - Smith Residence"
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <div className="flex gap-2">
                <Select value={formData.customer_id} onValueChange={handleCustomerChange} required>
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008]">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCustomerDialog(true)}
                  className="border-2 border-slate-300 hover:bg-[#fae008]/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Project Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="project_type">Type</Label>
                <Select value={formData.project_type} onValueChange={(val) => setFormData({ ...formData, project_type: val })}>
                  <SelectTrigger className="border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Installation">Installation</SelectItem>
                    <SelectItem value="Repair">Repair</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                    <SelectItem value="Motor">Motor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="awaiting_parts">Awaiting Parts</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Current Stage</Label>
              <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="measure">Measure</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="install">Install</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Technicians</Label>
              <div className="grid grid-cols-2 gap-2 border-2 border-slate-300 rounded-xl p-3">
                {technicians.map((tech) => (
                  <label key={tech.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={(formData.assigned_technicians || []).includes(tech.email)}
                      onChange={() => handleTechnicianToggle(tech.email)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{tech.full_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="border-2 border-slate-300 focus:border-[#fae008]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_completion_date">Target Completion</Label>
                <Input
                  id="target_completion_date"
                  type="date"
                  value={formData.target_completion_date}
                  onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                  className="border-2 border-slate-300 focus:border-[#fae008]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border-2 border-slate-300 rounded-xl p-3 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
                placeholder="Describe the project scope..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full border-2 border-slate-300 rounded-xl p-3 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20"
                placeholder="Additional notes..."
              />
            </div>
          </CardContent>
          <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-6 bg-slate-50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-2 hover:bg-white font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
            >
              {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="rounded-2xl border-2 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#000000]">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_customer_name">Name *</Label>
              <Input
                id="new_customer_name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                placeholder="Customer name"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_phone">Phone</Label>
              <Input
                id="new_customer_phone"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                placeholder="Phone number"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_email">Email</Label>
              <Input
                id="new_customer_email"
                type="email"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                placeholder="Email address"
                className="border-2 border-slate-300 focus:border-[#fae008]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_customer_type">Customer Type</Label>
              <Select
                value={newCustomerData.customer_type}
                onValueChange={(val) => setNewCustomerData({ ...newCustomerData, customer_type: val })}
              >
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate - Tenant">Real Estate - Tenant</SelectItem>
                  <SelectItem value="Strata - Owner">Strata - Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewCustomerDialog(false)}
              className="border-2 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={!newCustomerData.name || createCustomerMutation.isPending}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
