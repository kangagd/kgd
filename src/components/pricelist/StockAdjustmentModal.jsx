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
import { usePermissions, PERMISSIONS } from "@/components/auth/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { recordStockMovement } from "@/components/utils/stockHelpers";
import { toast } from "sonner";

export default function StockAdjustmentModal({ item, open, onClose, vehicles = [], locations = [] }) {
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // Combine all locations from inventory system + vehicles
  const allLocations = [
    ...locations,
    ...vehicles.map(v => ({ id: v.id, name: v.name, type: 'vehicle' }))
  ];

  const adjustStockMutation = useMutation({
    mutationFn: async (data) => {
      const quantityValue = parseInt(data.quantity);
      const fromLoc = data.fromLocation || null;
      const toLoc = data.toLocation || null;

      // Determine movement type
      let movementType = 'adjustment';
      if (!fromLoc && toLoc) {
        movementType = 'stock_in';
      } else if (fromLoc && !toLoc) {
        movementType = 'stock_out';
      } else if (fromLoc && toLoc) {
        movementType = 'transfer';
      }

      // Create StockMovement record
      const fromLocationObj = fromLoc ? allLocations.find(l => l.id === fromLoc) : null;
      const toLocationObj = toLoc ? allLocations.find(l => l.id === toLoc) : null;

      await base44.entities.StockMovement.create({
        price_list_item_id: item.id,
        item_name: item.item,
        from_location_id: fromLoc,
        from_location_name: fromLocationObj?.name || null,
        to_location_id: toLoc,
        to_location_name: toLocationObj?.name || null,
        quantity: quantityValue,
        movement_type: movementType,
        notes: data.notes,
      });

      // Update InventoryQuantity records
      if (fromLoc) {
        const fromQty = await base44.entities.InventoryQuantity.filter({
          price_list_item_id: item.id,
          location_id: fromLoc
        });
        if (fromQty.length > 0) {
          await base44.entities.InventoryQuantity.update(fromQty[0].id, {
            quantity: (fromQty[0].quantity || 0) - quantityValue
          });
        }
      }

      if (toLoc) {
        const toQty = await base44.entities.InventoryQuantity.filter({
          price_list_item_id: item.id,
          location_id: toLoc
        });
        if (toQty.length > 0) {
          await base44.entities.InventoryQuantity.update(toQty[0].id, {
            quantity: (toQty[0].quantity || 0) + quantityValue
          });
        } else {
          // Create new quantity record
          await base44.entities.InventoryQuantity.create({
            price_list_item_id: item.id,
            location_id: toLoc,
            quantity: quantityValue,
            item_name: item.item,
            location_name: toLocationObj?.name || 'Unknown'
          });
        }
      }

      // Update legacy stock_level on PriceListItem if warehouse location is involved
      const warehouseLoc = allLocations.find(l => l.type === 'warehouse');
      if (warehouseLoc && (toLoc === warehouseLoc.id || fromLoc === warehouseLoc.id)) {
        const delta = toLoc === warehouseLoc.id ? quantityValue : -quantityValue;
        await base44.entities.PriceListItem.update(item.id, {
          stock_level: Math.max(0, (item.stock_level || 0) + delta)
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      toast.success('Stock adjusted successfully');
      setQuantity("");
      setNotes("");
      setFromLocation("");
      setToLocation("");
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to adjust stock");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    adjustStockMutation.mutate({
      fromLocation,
      toLocation,
      quantity,
      notes
    });
  };

  if (!item) return null;

  const isStockIn = !fromLocation && toLocation;
  const isStockOut = fromLocation && !toLocation;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {item.item}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-600 mb-1">Current Stock (Legacy)</div>
            <div className="text-2xl font-bold text-slate-900">{item.stock_level || 0}</div>
          </div>

          <div>
            <Label>From Location</Label>
            <Select value={fromLocation} onValueChange={setFromLocation}>
              <SelectTrigger>
                <SelectValue placeholder="None (New stock)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None (New stock)</SelectItem>
                {allLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>To Location</Label>
            <Select value={toLocation} onValueChange={setToLocation}>
              <SelectTrigger>
                <SelectValue placeholder="None (Stock out)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None (Stock out)</SelectItem>
                {allLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
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

          {quantity && (fromLocation || toLocation) && (
            <div className={`rounded-lg p-4 border ${isStockIn ? 'bg-green-50 border-green-200' : isStockOut ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className={`text-sm mb-1 ${isStockIn ? 'text-green-600' : isStockOut ? 'text-red-600' : 'text-blue-600'}`}>
                {isStockIn ? 'Stock In' : isStockOut ? 'Stock Out' : 'Transfer'}
              </div>
              <div className="text-sm text-slate-600">
                {fromLocation && `From: ${allLocations.find(l => l.id === fromLocation)?.name}`}
                {fromLocation && toLocation && ' → '}
                {toLocation && `To: ${allLocations.find(l => l.id === toLocation)?.name}`}
              </div>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      type="submit"
                      disabled={adjustStockMutation.isPending || !quantity || (!fromLocation && !toLocation) || !can(PERMISSIONS.ADJUST_STOCK)}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!can(PERMISSIONS.ADJUST_STOCK) && (
                  <TooltipContent>
                    <p>Insufficient permissions</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}