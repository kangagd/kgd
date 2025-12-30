import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TextField from "../common/TextField";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { exToGstAmount, exToInc } from "@/components/gst";

export default function PriceListItemForm({ item, onSubmit, onCancel, isSubmitting, canViewCosts = false }) {
  const [formData, setFormData] = useState(item || {
    category: "",
    item: "",
    sku: "",
    brand: "",
    price: "",
    unit_cost: "",
    target_margin: "",
    description: "",
    track_inventory: true,
    in_inventory: true,
    stock_level: 0,
    min_stock_level: 5,
    car_quantity: 0,
    notes: "",
    supplier_id: "",
    supplier_name: "",
    image_url: "",
    is_active: true
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['activeSuppliers'],
    queryFn: () => base44.entities.Supplier.list('name'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSubmit({
      ...formData,
      price: parseFloat(formData.price) || 0,
      unit_cost: parseFloat(formData.unit_cost) || 0,
      target_margin: parseFloat(formData.target_margin) || 0,
      stock_level: parseFloat(formData.stock_level) || 0,
      min_stock_level: parseFloat(formData.min_stock_level) || 5,
      car_quantity: parseFloat(formData.car_quantity) || 0,
      // Sync legacy field
      in_inventory: formData.track_inventory
    });
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <CardTitle>{item ? 'Edit Price List Item' : 'New Price List Item'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Motor">Motor</SelectItem>
                    <SelectItem value="Remotes/Accessories">Remotes/Accessories</SelectItem>
                    <SelectItem value="Parts">Parts</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Item Name *</Label>
                <Input
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  placeholder="Enter item name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={formData.brand || ""}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Brand name"
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={formData.sku || ""}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Stock Keeping Unit"
                  />
                </div>
              </div>

              <div className={`grid ${canViewCosts ? 'grid-cols-3' : 'grid-cols-1'} gap-4`}>
                {canViewCosts && (
                <div>
                  <Label>Unit Cost (ex GST)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                    placeholder="0.00"
                  />
                  {formData.unit_cost && !isNaN(parseFloat(formData.unit_cost)) && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      GST: ${exToGstAmount(parseFloat(formData.unit_cost)).toFixed(2)} • Inc: ${exToInc(parseFloat(formData.unit_cost)).toFixed(2)}
                    </p>
                  )}
                </div>
                )}
                <div>
                  <Label>Sell Price (ex GST) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                  {formData.price && !isNaN(parseFloat(formData.price)) && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      GST: ${exToGstAmount(parseFloat(formData.price)).toFixed(2)} • Inc: ${exToInc(parseFloat(formData.price)).toFixed(2)}
                    </p>
                  )}
                </div>
                {canViewCosts && (
                <div>
                  <Label>Target Margin (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.target_margin}
                    onChange={(e) => setFormData({ ...formData, target_margin: e.target.value })}
                    placeholder="0%"
                  />
                </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <Select
                    value={formData.supplier_id || "none"}
                    onValueChange={(val) => {
                      const supplierId = val === "none" ? null : val;
                      const supplier = suppliers.find(s => s.id === supplierId);
                      setFormData({ 
                        ...formData, 
                        supplier_id: supplierId,
                        // Auto-fill name if supplier selected
                        supplier_name: supplier ? supplier.name : formData.supplier_name 
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Manual</SelectItem>
                      {suppliers.filter(s => s.is_active).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier Name (Manual/Override)</Label>
                  <Input
                    value={formData.supplier_name || ""}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    placeholder="Primary supplier"
                  />
                </div>
              </div>

              <div>
                <Label>Image</Label>
                {formData.image_url && (
                  <div className="mb-2">
                    <img src={formData.image_url} alt="Item" className="w-32 h-32 object-cover rounded-lg border" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, image_url: "" })}
                      className="mt-1 text-xs text-red-600"
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const { data } = await base44.integrations.Core.UploadFile({ file });
                        setFormData({ ...formData, image_url: data.file_url });
                        e.target.value = '';
                      } catch (error) {
                        console.error('Error uploading image:', error);
                      }
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock Level</Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.stock_level}
                    onChange={(e) => setFormData({ ...formData, stock_level: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Min Stock Level</Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    placeholder="5"
                  />
                </div>
                <div>
                  <Label>Car Quantity</Label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.car_quantity}
                    onChange={(e) => setFormData({ ...formData, car_quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <TextField
                label="Description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter item description and details…"
                multiline
                rows={3}
              />

              <TextField
                label="Notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes…"
                helperText="Internal only"
                multiline
                rows={2}
              />

              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="track_inventory"
                    checked={formData.track_inventory ?? formData.in_inventory}
                    onCheckedChange={(checked) => setFormData({ ...formData, track_inventory: checked, in_inventory: checked })}
                  />
                  <Label htmlFor="track_inventory" className="cursor-pointer">
                    Track Inventory
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={formData.is_active !== false}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Active Item
                  </Label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
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