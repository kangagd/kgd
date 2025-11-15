import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

export default function CustomerForm({ customer, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(customer || {
    name: "",
    customer_type: "",
    phone: "",
    email: "",
    secondary_phone: "",
    notes: "",
    status: "active",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone">Secondary Phone</Label>
              <Input
                id="secondary_phone"
                type="tel"
                value={formData.secondary_phone}
                onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Add any notes about the customer..."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
            {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}