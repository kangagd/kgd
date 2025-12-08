import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ConsumableFormModal({ open, onClose, consumable, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    default_quantity_expected: 1,
    notes: "",
  });

  useEffect(() => {
    if (consumable) {
      setFormData({
        name: consumable.name || "",
        category: consumable.category || "",
        default_quantity_expected: consumable.default_quantity_expected || 1,
        notes: consumable.notes || "",
      });
    } else {
      setFormData({
        name: "",
        category: "",
        default_quantity_expected: 1,
        notes: "",
      });
    }
  }, [consumable, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{consumable ? "Edit Consumable" : "Add Consumable"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Screws, Silicone, Spray Lube"
              required
            />
          </div>

          <div>
            <Label>Category</Label>
            <Input
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Fixings, Lubricants, Hardware"
            />
          </div>

          <div>
            <Label>Default Quantity Expected</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.default_quantity_expected}
              onChange={(e) => setFormData({ ...formData, default_quantity_expected: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#FAE008] hover:bg-[#E5CF07] text-black">
              {isSubmitting ? "Saving..." : consumable ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}