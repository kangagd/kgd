import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function AddCustomItemModal({ open, onClose, onAdd, itemType: initialType }) {
  const [itemType, setItemType] = useState(initialType || 'part');
  const [label, setLabel] = useState('');
  const [qty, setQty] = useState(1);

  const handleConfirm = () => {
    if (!label.trim()) return;

    const item = {
      label: label.trim(),
      type: itemType,
      ...(itemType === 'part' && qty && { qty })
    };

    onAdd(item);
    setLabel('');
    setQty(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#111827]">
            Add Custom Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-[13px]">Item Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="part">Part</SelectItem>
                <SelectItem value="trade">Trade</SelectItem>
                <SelectItem value="requirement">Requirement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[13px]">Description</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Custom spring, Electrical work, Safety check"
              className="mt-1.5"
            />
          </div>

          {itemType === 'part' && (
            <div>
              <Label className="text-[13px]">Quantity</Label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                min={1}
                className="mt-1.5"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-[#E5E7EB]">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!label.trim()}
            className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            Add Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}