import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PackagePlus, PackageMinus } from "lucide-react";

export default function StockAdjustmentModal({ item, open, onClose }) {
  const [movementType, setMovementType] = useState("stock_in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const adjustStockMutation = useMutation({
    mutationFn: async (data) => {
      const quantityValue = parseInt(data.quantity);
      const adjustedQuantity = data.movementType === 'stock_out' ? -quantityValue : quantityValue;
      const newStock = item.stock_level + adjustedQuantity;

      await base44.entities.InventoryMovement.create({
        price_list_item_id: item.id,
        item_name: item.item,
        movement_type: data.movementType,
        quantity: adjustedQuantity,
        previous_stock: item.stock_level,
        new_stock: newStock,
        notes: data.notes
      });

      await base44.entities.PriceListItem.update(item.id, {
        stock_level: newStock
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      setQuantity("");
      setNotes("");
      setMovementType("stock_in");
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    adjustStockMutation.mutate({
      movementType,
      quantity,
      notes
    });
  };

  if (!item) return null;

  const newStock = movementType === 'stock_out' 
    ? item.stock_level - parseInt(quantity || 0)
    : item.stock_level + parseInt(quantity || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-2 border-slate-300 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b-2 border-slate-200">
          <DialogTitle className="text-xl font-bold text-[#000000] tracking-tight">
            Adjust Stock - {item.item}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border-2 border-slate-200">
            <div className="text-sm text-slate-600 font-medium mb-2">Current Stock</div>
            <div className="text-4xl font-bold text-[#000000]">{item.stock_level}</div>
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Movement Type</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock_in">
                  <div className="flex items-center gap-2">
                    <PackagePlus className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Stock In (Receiving)</span>
                  </div>
                </SelectItem>
                <SelectItem value="stock_out">
                  <div className="flex items-center gap-2">
                    <PackageMinus className="w-4 h-4 text-red-600" />
                    <span className="font-semibold">Stock Out (Manual)</span>
                  </div>
                </SelectItem>
                <SelectItem value="adjustment">
                  <span className="font-semibold">Adjustment (Correction)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-bold text-[#000000]">Quantity *</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              required
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 font-semibold"
            />
          </div>

          {quantity && (
            <div className={`rounded-xl p-5 border-2 ${newStock < 0 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'}`}>
              <div className="text-sm font-medium mb-2 text-blue-700">New Stock Level</div>
              <div className={`text-4xl font-bold ${newStock < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                {newStock}
              </div>
              {newStock < 0 && (
                <div className="text-sm text-red-600 mt-2 font-semibold">
                  Warning: Stock cannot be negative
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="font-bold text-[#000000]">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this adjustment..."
              rows={3}
              className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={adjustStockMutation.isPending}
              className="flex-1 h-12 font-semibold border-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustStockMutation.isPending || !quantity || newStock < 0}
              className="flex-1 h-12 bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}