import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import RichTextEditor from "../common/RichTextEditor";

export default function OrganisationForm({ organisation, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(organisation || {
    name: "",
    organisation_type: undefined,
    address: "",
    phone: "",
    email: "",
    notes: "",
    status: "active"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter out empty strings and undefined values for optional enum fields
    const submitData = { ...formData };
    if (!submitData.organisation_type) {
      delete submitData.organisation_type;
    }
    onSubmit(submitData);
  };

  return (
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
            {organisation ? 'Edit Organisation' : 'Create New Organisation'}
          </CardTitle>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-[#000000]">Organisation Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="organisation_type" className="text-sm font-semibold text-[#000000]">Type</Label>
              <Select value={formData.organisation_type || ""} onValueChange={(val) => setFormData({ ...formData, organisation_type: val || undefined })}>
                <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20">
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

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-semibold text-[#000000]">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-semibold text-[#000000]">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-[#000000]">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-[#000000]">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold text-[#000000]">Notes</Label>
            <RichTextEditor
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any notes about this organisation..."
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
            {isSubmitting ? 'Saving...' : organisation ? 'Update Organisation' : 'Create Organisation'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}