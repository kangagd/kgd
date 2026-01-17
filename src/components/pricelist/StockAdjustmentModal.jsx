import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getPhysicalAvailableLocations, normalizeLocationType } from "@/components/utils/inventoryLocationUtils";
import { v4 as uuidv4 } from "npm:uuid@9.0.0";

export default function StockAdjustmentModal({ item, open, onClose, locations = [] }) {
  const [location, setLocation] = useState("");
  const [isExactCount, setIsExactCount] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  // Physical locations only (warehouse + vehicles)
  const availableLocations = useMemo(() => {
    return getPhysicalAvailableLocations(locations || []);
  }, [locations]);

  const adjustmentMutation = useMutation({
    mutationFn: async (data) => {
      // Fetch current inventory quantity
      const current = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: item.id,
        location_id: data.location
      });

      const currentQty = current[0]?.quantity || 0;
      const newQty = data.isExactCount ? data.quantity : currentQty + data.quantity;

      // Ensure non-negative
      if (newQty < 0) {
        throw new Error('Stock cannot be negative');
      }

      const delta = newQty - currentQty;

      // Update InventoryQuantity
      if (current[0]) {
        await base44.asServiceRole.entities.InventoryQuantity.update(current[0].id, {
          quantity: newQty
        });
      } else {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id: item.id,
          location_id: data.location,
          quantity: newQty,
          item_name: item.item,
          location_name: locations.find(l => l.id === data.location)?.name || ''
        });
      }

      // Create StockMovement audit record
      const batchId = uuidv4();
      await base44.asServiceRole.entities.StockMovement.create({
        sku_id: item.id,
        item_name: item.item,
        quantity: Math.abs(delta),
        from_location_id: delta < 0 ? data.location : null,
        from_location_name: delta < 0 ? locations.find(l => l.id === data.location)?.name : null,
        to_location_id: delta > 0 ? data.location : null,
        to_location_name: delta > 0 ? locations.find(l => l.id === data.location)?.name : null,
        performed_by_user_id: (await base44.auth.me()).id,
        performed_by_user_email: (await base44.auth.me()).email,
        performed_by_user_name: (await base44.auth.me()).full_name || (await base44.auth.me()).display_name,
        performed_at: new Date().toISOString(),
        source: 'correction_adjustment',
        notes: `Admin correction: ${data.isExactCount ? `set exact: ${currentQty} → ${newQty}` : `delta: ${delta > 0 ? '+' : ''}${delta}`}. Reason: ${data.reason}`
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      toast.success('Stock corrected successfully');
      setLocation("");
      setQuantity("");
      setReason("");
      setIsExactCount(true);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to correct stock");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!location || !reason || quantity === "") {
      toast.error("Location, quantity, and reason are required");
      return;
    }
    adjustmentMutation.mutate({
      location,
      quantity: parseInt(quantity) || 0,
      reason,
      isExactCount
    });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock (Admin) — {item.item}</DialogTitle>
          <DialogDescription>
            Use only to correct counts after stocktake errors. For receiving use PO Receive. For moving stock use Transfer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Location *</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {normalizeLocationType(loc.type) === 'warehouse' && '📦 '}
                    {normalizeLocationType(loc.type) === 'vehicle' && '🚗 '}
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="exact-count"
                checked={isExactCount}
                onCheckedChange={setIsExactCount}
              />
              <Label htmlFor="exact-count" className="font-normal cursor-pointer">
                Set exact count
              </Label>
            </div>
            <p className="text-xs text-slate-500 ml-6">
              {isExactCount ? "Replace current count with new number" : "Add or subtract from current count"}
            </p>
          </div>

          <div>
            <Label>{isExactCount ? "New Count *" : "Change By (+/-) *"}</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isExactCount ? "0" : "+/- 0"}
              required
            />
          </div>

          <div>
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 'Physical stocktake found 3 extra units in warehouse'"
              rows={2}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={adjustmentMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={adjustmentMutation.isPending || !location || !reason || quantity === ""}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {adjustmentMutation.isPending ? 'Correcting...' : 'Correct Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}