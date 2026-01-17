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
      const response = await base44.functions.invoke('adjustStockCorrection', {
        priceListItemId: item.id,
        locationId: data.location,
        quantity: data.quantity,
        isExactCount: data.isExactCount,
        reason: data.reason
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to adjust stock');
      }

      return response.data;
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