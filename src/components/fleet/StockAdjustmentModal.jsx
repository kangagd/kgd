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
      setNewQuantity(item.quantity_on_hand || 0);
      setReason("");
    }
  }, [open, item]);

  const adjustMutation = useMutation({
    mutationFn: async (data) => {
      const inventoryLoc = await base44.entities.InventoryLocation.filter({ 
        type: 'vehicle',
        vehicle_id: vehicleId 
      });
      
      if (inventoryLoc.length === 0) {
        throw new Error("Vehicle location not found");
      }

      const quantities = await base44.entities.InventoryQuantity.filter({
        location_id: inventoryLoc[0].id,
        price_list_item_id: data.product_id
      });

      if (quantities.length === 0) {
        throw new Error("Item not found in vehicle inventory");
      }

      const currentQty = quantities[0].quantity;
      const newQty = data.new_quantity;
      
      await base44.entities.InventoryQuantity.update(quantities[0].id, {
        quantity: newQty
      });

      await base44.entities.StockMovement.create({
        price_list_item_id: data.product_id,
        item_name: item.product_name,
        to_location_id: inventoryLoc[0].id,
        to_location_name: inventoryLoc[0].name,
        quantity: Math.abs(newQty - currentQty),
        movement_type: 'adjustment',
        notes: data.reason,
        moved_by: (await base44.auth.me()).email,
        moved_by_name: (await base44.auth.me()).full_name
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
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

    adjustMutation.mutate({
      vehicle_id: vehicleId,
      product_id: item.product_id,
      new_quantity: parseInt(newQuantity),
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
            <div className="font-medium text-lg">{item?.quantity_on_hand || 0}</div>
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