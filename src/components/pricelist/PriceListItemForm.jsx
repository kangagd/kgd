import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";

export default function PriceListItemForm({ item, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(item || {
    category: "",
    item: "",
    price: "",
    description: "",
    in_inventory: true,
    stock_level: 0,
    min_stock_level: 5,
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: parseFloat(formData.price) || 0,
      stock_level: parseFloat(formData.stock_level) || 0,
      min_stock_level: parseFloat(formData.min_stock_level) || 5
    });
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Card className="border-2 border-slate-200 shadow-2xl rounded-2xl">
          <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-white to-slate-50">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onCancel} className="h-10 w-10 hover:bg-slate-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
                {item ? 'Edit Price List Item' : 'New Price List Item'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="font-bold text-[#000000]">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                  required
                >
                  <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service" className="font-semibold">Service</SelectItem>
                    <SelectItem value="Motor" className="font-semibold">Motor</SelectItem>
                    <SelectItem value="Remotes/Accessories" className="font-semibold">Remotes/Accessories</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-bold text-[#000000]">Item Name *</Label>
                <Input
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  placeholder="Enter item name"
                  required
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
                />
              </div>

              <div>
                <Label className="font-bold text-[#000000]">Price (AUD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <Label className="font-bold text-[#000000]">Stock Level</Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.stock_level}
                    onChange={(e) => setFormData({ ...formData, stock_level: e.target.value })}
                    placeholder="0"
                    className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#000000]">Min Stock Level</Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    placeholder="5"
                    className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#000000]">Description</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter item description"
                  rows={3}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>

              <div>
                <Label className="font-bold text-[#000000]">Notes</Label>
                <Textarea
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>

              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
                <Checkbox
                  id="in_inventory"
                  checked={formData.in_inventory}
                  onCheckedChange={(checked) => setFormData({ ...formData, in_inventory: checked })}
                />
                <Label htmlFor="in_inventory" className="cursor-pointer font-semibold text-[#000000]">
                  Item is in inventory
                </Label>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="flex-1 h-12 font-semibold border-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {isSubmitting ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}