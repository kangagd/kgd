import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import BackButton from "../common/BackButton";

export default function ThirdPartyTradeForm({ trade, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: "",
    type: "Electrician",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    is_active: true
  });

  useEffect(() => {
    if (trade) {
      setFormData({
        name: trade.name || "",
        type: trade.type || "Electrician",
        contact_name: trade.contact_name || "",
        contact_email: trade.contact_email || "",
        contact_phone: trade.contact_phone || "",
        notes: trade.notes || "",
        is_active: trade.is_active !== false
      });
    }
  }, [trade]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="border-b border-[#E5E7EB] bg-white">
        <div className="flex items-center gap-3">
          <BackButton onClick={onCancel} />
          <CardTitle className="text-[18px] font-semibold text-[#111827]">
            {trade ? "Edit" : "New"} Third-Party Trade
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trade Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., ABC Electrical"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Trade Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(val) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Electrician">Electrician</SelectItem>
                  <SelectItem value="Gate Installer">Gate Installer</SelectItem>
                  <SelectItem value="Post Installer">Post Installer</SelectItem>
                  <SelectItem value="Concreter">Concreter</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Primary contact person"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Phone number"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="Email address"
                type="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this trade..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Label className="text-sm font-medium">Active</Label>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              {isSubmitting ? "Saving..." : trade ? "Update Trade" : "Create Trade"}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}