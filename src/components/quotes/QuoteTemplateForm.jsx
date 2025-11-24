import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

export default function QuoteTemplateForm({ template, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(template || {
    name: "",
    description: "",
    category: "Other",
    unit_price: 0,
    unit_label: "each",
    default_quantity: 1,
    is_active: true,
    sort_order: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
        <CardHeader className="border-b border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCancel}
              className="hover:bg-[#F3F4F6]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-xl font-semibold text-[#111827]">
              {template ? 'Edit Template' : 'Create New Template'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Standard Service Call"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template includes..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Labor">Labor</SelectItem>
                    <SelectItem value="Materials">Materials</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_label">Unit Label *</Label>
                <Input
                  id="unit_label"
                  value={formData.unit_label}
                  onChange={(e) => setFormData({ ...formData, unit_label: e.target.value })}
                  required
                  placeholder="e.g., each, hour, set"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="default_quantity">Default Quantity *</Label>
                <Input
                  id="default_quantity"
                  type="number"
                  value={formData.default_quantity}
                  onChange={(e) => setFormData({ ...formData, default_quantity: parseFloat(e.target.value) || 1 })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_price">Unit Price *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-[#E5E7EB] flex justify-end gap-3 p-6 bg-[#F9FAFB]">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
            >
              {isSubmitting ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}