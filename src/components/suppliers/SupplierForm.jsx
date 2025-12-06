import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";

const SUPPLIER_TYPES = [
  "Door Manufacturer",
  "Motor Supplier",
  "Hardware",
  "Glass",
  "Steel / Fabrication",
  "Other",
];

export default function SupplierForm({ supplier, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(supplier || {
    name: "",
    type: "",
    contact_name: "",
    phone: "",
    email: "",
    pickup_address: "",
    opening_hours: "",
    notes: "",
    default_lead_time_days: "",
    is_active: true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert lead time to number if present
    const submitData = {
        ...formData,
        default_lead_time_days: formData.default_lead_time_days ? Number(formData.default_lead_time_days) : null
    };
    onSubmit(submitData);
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-2xl font-bold">
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </CardTitle>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Supplier Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="input-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(val) => setFormData({ ...formData, type: val })}
            >
              <SelectTrigger className="select-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="input-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_address">Pickup Address</Label>
            <Textarea
              id="pickup_address"
              value={formData.pickup_address}
              onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
              className="textarea-sm min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opening_hours">Opening Hours</Label>
            <Input
              id="opening_hours"
              placeholder="e.g. Mon–Fri 7:00–3:30"
              value={formData.opening_hours}
              onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
              className="input-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes for Pickup</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Use rear loading dock..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="textarea-sm min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_time">Default Lead Time (days)</Label>
            <Input
              id="lead_time"
              type="number"
              value={formData.default_lead_time_days}
              onChange={(e) => setFormData({ ...formData, default_lead_time_days: e.target.value })}
              className="input-sm"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
            />
            <Label>Active</Label>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} size="sm">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!formData.name || isSubmitting} 
            size="sm"
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {isSubmitting ? 'Saving...' : (supplier ? 'Update Supplier' : 'Create Supplier')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}