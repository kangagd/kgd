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
import { Checkbox } from "@/components/ui/checkbox";

export default function RestockRequestModal({ open, onClose, vehicle, stock }) {
  const [selectedItems, setSelectedItems] = useState({});
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const lowStockItems = stock.filter(i => i.quantity_on_hand < (i.minimum_target_quantity || 0));

  // Initialize selected items with low stock recommendations
  React.useEffect(() => {
    if (open) {
      const initialSelection = {};
      lowStockItems.forEach(item => {
        initialSelection[item.product_id] = {
          selected: true,
          quantity: Math.max(1, (item.minimum_target_quantity || 0) - item.quantity_on_hand),
          item: item
        };
      });
      setSelectedItems(initialSelection);
      setNotes("");
    }
  }, [open, stock]);

  const restockMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createRestockRequest', data);
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Restock request submitted");
      onClose();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = () => {
    const items = Object.values(selectedItems)
      .filter(i => i.selected && i.quantity > 0)
      .map(i => ({
        product_id: i.item.product_id,
        product_name: i.item.product_name,
        quantity: parseInt(i.quantity),
        current_quantity: i.item.quantity_on_hand,
        min_quantity: i.item.minimum_target_quantity
      }));

    if (items.length === 0 && !notes) {
      toast.error("Please select items or add notes");
      return;
    }

    restockMutation.mutate({
      vehicle_id: vehicle.id,
      items,
      notes
    });
  };

  const toggleItem = (productId, item) => {
    setSelectedItems(prev => {
      const existing = prev[productId];
      if (existing) {
        return {
          ...prev,
          [productId]: { ...existing, selected: !existing.selected }
        };
      } else {
        return {
          ...prev,
          [productId]: {
            selected: true,
            quantity: 1,
            item: item
          }
        };
      }
    });
  };

  const updateQuantity = (productId, quantity) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: quantity }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Restock</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Low Stock Items</Label>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No items currently below minimum quantity.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {lowStockItems.map(item => {
                  const selection = selectedItems[item.product_id] || { selected: false, quantity: 0 };
                  return (
                    <div key={item.id} className="p-3 flex items-center gap-3">
                      <Checkbox 
                        checked={selection.selected}
                        onCheckedChange={() => toggleItem(item.product_id, item)}
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-gray-500 text-xs">
                          Current: {item.quantity_on_hand} / Min: {item.minimum_target_quantity}
                        </div>
                      </div>
                      {selection.selected && (
                        <div className="w-20">
                          <Input 
                            type="number" 
                            min="1"
                            value={selection.quantity}
                            onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                            className="h-8"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes / Additional Items</Label>
            <Textarea 
              placeholder="Please add 5 extra remotes for the upcoming project..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={restockMutation.isPending}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-black"
          >
            {restockMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}