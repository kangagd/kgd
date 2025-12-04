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

      // Log the movement
      await base44.entities.InventoryMovement.create({
        price_list_item_id: item.id,
        item_name: item.item,
        movement_type: data.movementType,
        quantity: adjustedQuantity,
        previous_stock: item.stock_level,
        new_stock: newStock,
        notes: data.notes
      });

      // Update the item stock
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {item.item}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Current Stock</div>
            <div className="text-2xl font-bold text-slate-900">{item.stock_level}</div>
          </div>

          <div>
            <Label>Movement Type</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock_in">
                  <div className="flex items-center gap-2">
                    <PackagePlus className="w-4 h-4 text-green-600" />
                    Stock In (Receiving)
                  </div>
                </SelectItem>
                <SelectItem value="stock_out">
                  <div className="flex items-center gap-2">
                    <PackageMinus className="w-4 h-4 text-red-600" />
                    Stock Out (Manual)
                  </div>
                </SelectItem>
                <SelectItem value="adjustment">Adjustment (Correction)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity *</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              required
            />
          </div>

          {quantity && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">New Stock Level</div>
              <div className={`text-2xl font-bold ${newStock < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                {newStock}
              </div>
              {newStock < 0 && (
                <div className="text-xs text-red-600 mt-1">
                  Warning: Stock cannot be negative
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this adjustment..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={adjustStockMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustStockMutation.isPending || !quantity || newStock < 0}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}