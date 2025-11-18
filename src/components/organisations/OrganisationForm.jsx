import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import RichTextEditor from "../common/RichTextEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export default function OrganisationForm({ organisation, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(organisation || {
    name: "",
    organisation_type: undefined,
    sp_number: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    status: "active"
  });

  const [errors, setErrors] = useState({});

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

  const handlePhoneBlur = () => {
    if (formData.phone && !validatePhone(formData.phone)) {
      setErrors({ ...errors, phone: 'Please enter a valid phone number' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.phone;
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
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    const submitData = { ...formData };
    if (!submitData.organisation_type) {
      delete submitData.organisation_type;
    }
    if (!submitData.sp_number) {
      delete submitData.sp_number;
    }
    if (!submitData.address) {
      delete submitData.address;
    }
    if (!submitData.phone) {
      delete submitData.phone;
    }
    if (!submitData.email) {
      delete submitData.email;
    }
    if (!submitData.notes) {
      delete submitData.notes;
    }
    onSubmit(submitData);
  };

  return (
    <div className="p-4 space-y-3">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCancel}
              className="hover:bg-slate-100 h-9 w-9 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-slate-900">
              {organisation ? 'Edit Organisation' : 'Create New Organisation'}
            </h1>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Basic Information</span>
            
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">Organisation Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="border-slate-300 h-10"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="organisation_type" className="text-sm font-medium text-slate-700">Type</Label>
                <Select value={formData.organisation_type || ""} onValueChange={(val) => setFormData({ ...formData, organisation_type: val || undefined })}>
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
            </div>

            {formData.organisation_type === "Strata" && (
              <div className="space-y-1">
                <Label htmlFor="sp_number" className="text-sm font-medium text-slate-700">SP Number</Label>
                <Input
                  id="sp_number"
                  value={formData.sp_number}
                  onChange={(e) => setFormData({ ...formData, sp_number: e.target.value })}
                  placeholder="Strata Plan number"
                  className="border-slate-300 h-10"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contact Details</span>
            
            <div className="space-y-1">
              <Label htmlFor="address" className="text-sm font-medium text-slate-700">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="border-slate-300 h-10"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  onBlur={handlePhoneBlur}
                  className={`border-slate-300 h-10 ${errors.phone ? 'border-red-500' : ''}`}
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
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
                  placeholder="Add any notes about this organisation..."
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
            {isSubmitting ? 'Saving...' : organisation ? 'Update Organisation' : 'Create Organisation'}
          </Button>
        </div>
      </form>
    </div>
  );
}