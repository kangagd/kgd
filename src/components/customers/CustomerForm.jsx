import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import RichTextEditor from "../common/RichTextEditor";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export default function CustomerForm({ customer, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(customer || {
    name: "",
    customer_type: "",
    phone: "",
    email: "",
    secondary_phone: "",
    address: "",
    notes: "",
    status: "active",
    organisation_id: "",
    organisation_name: ""
  });

  const [errors, setErrors] = useState({});
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [newOrgData, setNewOrgData] = useState({ name: "", organisation_type: undefined, sp_number: "", address: "" });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const queryClient = useQueryClient();

  const { data: organisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.filter({ status: 'active', deleted_at: { $exists: false } })
  });

  const validateEmail = (email) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    if (!phone) return true;
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
  };

  const handleEmailBlur = () => {
    if (formData.email && !validateEmail(formData.email)) {
      setErrors({ ...errors, email: 'Please enter a valid email address' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.email;
      setErrors(newErrors);
    }
  };

  const handlePhoneBlur = (field) => {
    const value = formData[field];
    if (value && !validatePhone(value)) {
      setErrors({ ...errors, [field]: 'Please enter a valid phone number' });
    } else {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = {};
    if (formData.email && !validateEmail(formData.email)) {
      validationErrors.email = 'Please enter a valid email address';
    }
    if (formData.phone && !validatePhone(formData.phone)) {
      validationErrors.phone = 'Please enter a valid phone number';
    }
    if (formData.secondary_phone && !validatePhone(formData.secondary_phone)) {
      validationErrors.secondary_phone = 'Please enter a valid phone number';
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    onSubmit(formData);
  };

  const handleOrganisationChange = (orgId) => {
    const org = organisations.find(o => o.id === orgId);
    setFormData({
      ...formData,
      organisation_id: orgId,
      organisation_name: org?.name || ""
    });
  };

  const handleCreateNewOrg = async () => {
    setIsCreatingOrg(true);
    try {
      const submitData = { ...newOrgData };
      if (!submitData.organisation_type) {
        delete submitData.organisation_type;
      }
      if (!submitData.sp_number) {
        delete submitData.sp_number;
      }
      if (!submitData.address) {
        delete submitData.address;
      }
      
      const newOrg = await base44.entities.Organisation.create(submitData);
      
      await queryClient.invalidateQueries({ queryKey: ['organisations'] });
      
      setFormData({
        ...formData,
        organisation_id: newOrg.id,
        organisation_name: newOrg.name
      });
      
      setShowNewOrgDialog(false);
      setNewOrgData({ name: "", organisation_type: undefined, sp_number: "", address: "" });
    } catch (error) {
      console.error("Error creating organisation:", error);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <>
      <div className="p-4 space-y-3">
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-slate-100 h-9 w-9 flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-slate-900">
                {customer ? 'Edit Customer' : 'New Customer'}
              </h1>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Basic Information</span>
              
              <div className="space-y-1">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Customer Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="border-slate-300 h-10"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="customer_type" className="text-sm font-medium text-slate-700">Customer Type</Label>
                <Select value={formData.customer_type} onValueChange={(val) => setFormData({ ...formData, customer_type: val })}>
                  <SelectTrigger className="border-slate-300 h-10">
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Builder">Builder</SelectItem>
                    <SelectItem value="Real Estate - Tenant">Real Estate - Tenant</SelectItem>
                    <SelectItem value="Strata - Owner">Strata - Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="organisation_id" className="text-sm font-medium text-slate-700">Organisation</Label>
                <div className="flex gap-2">
                  <Select value={formData.organisation_id} onValueChange={handleOrganisationChange}>
                    <SelectTrigger className="flex-1 border-slate-300 h-10">
                      <SelectValue placeholder="Select organisation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {organisations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}{org.organisation_type ? ` (${org.organisation_type})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewOrgDialog(true)}
                    className="border-slate-300 hover:bg-slate-50 h-10 w-10 p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contact Information</span>
              
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Primary Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={() => handlePhoneBlur('phone')}
                    className={`border-slate-300 h-10 ${errors.phone ? 'border-red-500' : ''}`}
                  />
                  {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="secondary_phone" className="text-sm font-medium text-slate-700">Secondary Phone</Label>
                  <Input
                    id="secondary_phone"
                    type="tel"
                    value={formData.secondary_phone}
                    onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                    onBlur={() => handlePhoneBlur('secondary_phone')}
                    className={`border-slate-300 h-10 ${errors.secondary_phone ? 'border-red-500' : ''}`}
                  />
                  {errors.secondary_phone && <p className="text-xs text-red-600 mt-1">{errors.secondary_phone}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onBlur={handleEmailBlur}
                  className={`border-slate-300 h-10 ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Default address for this customer"
                  className="border-slate-300 h-10"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="status" className="text-sm font-medium text-slate-700">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="border-slate-300 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Collapsible defaultOpen={false}>
            <Card className="shadow-sm border border-slate-200">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <RichTextEditor
                    value={formData.notes}
                    onChange={(value) => setFormData({ ...formData, notes: value })}
                    placeholder="Add any notes about the customer..."
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-2 shadow-sm">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-slate-300 hover:bg-slate-50 h-10 px-4 font-medium rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 h-10 px-4 font-medium rounded-lg"
            >
              {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="rounded-lg border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">New Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new_org_name" className="text-sm font-medium text-slate-700">Name *</Label>
              <Input
                id="new_org_name"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                className="border-slate-300 h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_org_type" className="text-sm font-medium text-slate-700">Type</Label>
              <Select value={newOrgData.organisation_type || ""} onValueChange={(val) => setNewOrgData({ ...newOrgData, organisation_type: val || undefined })}>
                <SelectTrigger className="border-slate-300 h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strata">Strata</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newOrgData.organisation_type === "Strata" && (
              <div className="space-y-1">
                <Label htmlFor="new_org_sp" className="text-sm font-medium text-slate-700">SP Number</Label>
                <Input
                  id="new_org_sp"
                  value={newOrgData.sp_number}
                  onChange={(e) => setNewOrgData({ ...newOrgData, sp_number: e.target.value })}
                  placeholder="Strata Plan number"
                  className="border-slate-300 h-10"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="new_org_address" className="text-sm font-medium text-slate-700">Address</Label>
              <Input
                id="new_org_address"
                value={newOrgData.address}
                onChange={(e) => setNewOrgData({ ...newOrgData, address: e.target.value })}
                className="border-slate-300 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewOrgDialog(false)}
              className="border-slate-300 font-medium h-9 rounded-lg"
              disabled={isCreatingOrg}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewOrg}
              disabled={!newOrgData.name || isCreatingOrg}
              className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-9 rounded-lg"
            >
              {isCreatingOrg ? 'Creating...' : 'Create Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}