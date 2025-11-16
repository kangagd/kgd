import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import RichTextEditor from "../common/RichTextEditor";

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
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
      <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
            {customer ? 'Edit Customer' : 'New Customer'}
          </CardTitle>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold text-[#000000]">Customer Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="h-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_type" className="text-sm font-bold text-[#000000]">Customer Type</Label>
            <Select value={formData.customer_type} onValueChange={(val) => setFormData({ ...formData, customer_type: val })}>
              <SelectTrigger className="h-11 border-2 border-slate-300 focus:border-[#fae008] rounded-xl">
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
              <Label htmlFor="phone" className="text-sm font-bold text-[#000000]">Primary Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone" className="text-sm font-bold text-[#000000]">Secondary Phone</Label>
              <Input
                id="secondary_phone"
                type="tel"
                value={formData.secondary_phone}
                onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                className="h-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold text-[#000000]">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-bold text-[#000000]">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Default address for this customer"
              className="h-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-bold text-[#000000]">Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
              <SelectTrigger className="h-11 border-2 border-slate-300 focus:border-[#fae008] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-bold text-[#000000]">Notes</Label>
            <RichTextEditor
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any notes about the customer..."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-5">
          <Button type="button" variant="outline" onClick={onCancel} className="border-2 font-semibold hover:bg-slate-100 transition-all rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#fae008] text-[#000000] hover:bg-[#e5d007] font-semibold shadow-md hover:shadow-lg transition-all rounded-xl">
            {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}