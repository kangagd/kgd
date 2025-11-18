import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// Removed Textarea import as it's replaced by RichTextEditor for notes
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
      // Filter out empty/undefined fields
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
      
      // Invalidate queries to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['organisations'] });
      
      // Update form data with new organisation
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
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-2xl font-bold">
              {customer ? 'Edit Customer' : 'New Customer'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organisation_id">Organisation (Optional)</Label>
              <div className="flex gap-2">
                <Select value={formData.organisation_id} onValueChange={handleOrganisationChange}>
                  <SelectTrigger className="flex-1">
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
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_type">Customer Type</Label>
              <Select value={formData.customer_type} onValueChange={(val) => setFormData({ ...formData, customer_type: val })}>
                <SelectTrigger>
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

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Primary Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  onBlur={() => handlePhoneBlur('phone')}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_phone">Secondary Phone</Label>
                <Input
                  id="secondary_phone"
                  type="tel"
                  value={formData.secondary_phone}
                  onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                  onBlur={() => handlePhoneBlur('secondary_phone')}
                  className={errors.secondary_phone ? 'border-red-500' : ''}
                />
                {errors.secondary_phone && <p className="text-xs text-red-600">{errors.secondary_phone}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={handleEmailBlur}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Default address for this customer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <RichTextEditor
                value={formData.notes}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Add any notes about the customer..."
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-black font-bold shadow-md hover:shadow-lg transition-all">
              {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-black">New Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_org_name">Name *</Label>
              <Input
                id="new_org_name"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_org_type">Type</Label>
              <Select value={newOrgData.organisation_type || ""} onValueChange={(val) => setNewOrgData({ ...newOrgData, organisation_type: val || undefined })}>
                <SelectTrigger className="border-2 border-slate-300">
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
              <div className="space-y-2">
                <Label htmlFor="new_org_sp">SP Number</Label>
                <Input
                  id="new_org_sp"
                  value={newOrgData.sp_number}
                  onChange={(e) => setNewOrgData({ ...newOrgData, sp_number: e.target.value })}
                  placeholder="Strata Plan number"
                  className="border-2 border-slate-300"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new_org_address">Address</Label>
              <Input
                id="new_org_address"
                value={newOrgData.address}
                onChange={(e) => setNewOrgData({ ...newOrgData, address: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewOrgDialog(false)}
              className="border-2 font-semibold"
              disabled={isCreatingOrg}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewOrg}
              disabled={!newOrgData.name || isCreatingOrg}
              className="bg-[#fae008] hover:bg-[#e5d007] text-black font-bold"
            >
              {isCreatingOrg ? 'Creating...' : 'Create Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}