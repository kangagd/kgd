import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function StockAdjustmentModal({ open, onClose, item, vehicleId }) {
  const [newQuantity, setNewQuantity] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (open && item) {
      setNewQuantity(item.quantity_on_hand);
      setReason("");
    }
  }, [open, item]);

  const adjustMutation = useMutation({
    mutationFn: async (data) => {
      // Get vehicle location first
      const locations = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicleId
      });
      const locationId = locations[0]?.id;

      if (!locationId) throw new Error('Vehicle location not found');

      const response = await base44.functions.invoke('moveInventory', {
        priceListItemId: item.product_id,
        fromLocationId: locationId,
        toLocationId: locationId,
        quantity: Math.abs(data.difference),
        movementType: 'adjustment',
        notes: data.reason
      });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      toast.success("Stock adjusted successfully");
      onClose();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = () => {
    if (newQuantity === "" || newQuantity < 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const currentQty = parseInt(item.quantity_on_hand);
    const newQty = parseInt(newQuantity);
    const difference = newQty - currentQty;

    if (difference === 0) {
      toast.error("Quantity hasn't changed");
      return;
    }

    adjustMutation.mutate({
      difference,
      reason: reason || "Manual adjustment"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock: {item?.product_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Quantity</Label>
            <div className="font-medium text-lg">{item?.quantity_on_hand}</div>
          </div>

          <div className="space-y-2">
            <Label>New Quantity</Label>
            <Input 
              type="number" 
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea 
              placeholder="e.g. Found extra stock, Damaged item..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={adjustMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {adjustMutation.isPending ? "Saving..." : "Save Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}