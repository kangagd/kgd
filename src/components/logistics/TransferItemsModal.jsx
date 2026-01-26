import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function TransferItemsModal({ 
  open, 
  onOpenChange, 
  jobId,
  sourceLocation, 
  destinationLocation, 
  items = [] 
}) {
  const queryClient = useQueryClient();
  const [transferQtys, setTransferQtys] = useState({});
  const [notes, setNotes] = useState("");

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!sourceLocation || !destinationLocation) {
        throw new Error('Source and destination locations are required');
      }

      const itemsToTransfer = items
        .filter(item => transferQtys[item.id] > 0)
        .map(item => ({
          price_list_item_id: item.price_list_item_id,
          qty: transferQtys[item.id]
        }));

      if (itemsToTransfer.length === 0) {
        throw new Error('Please enter quantities to transfer for at least one item');
      }

      const response = await base44.functions.invoke('processLogisticsJobStockActions', {
        job_id: jobId,
        mode: 'transfer',
        from_location_id: sourceLocation.id,
        to_location_id: destinationLocation.id,
        transfer_items: itemsToTransfer,
        notes: notes
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to transfer items');
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Transferred ${data.items_processed} item(s)`);
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      onOpenChange(false);
      setTransferQtys({});
      setNotes("");
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to transfer items');
    }
  });

  const handleTransfer = () => {
    transferMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transfer Route */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#F9FAFB] rounded-lg">
              <div className="text-xs text-[#6B7280] mb-1">From</div>
              <div className="font-medium text-[#111827]">{sourceLocation?.name || '—'}</div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-[#6B7280]" />
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg">
              <div className="text-xs text-[#6B7280] mb-1">To</div>
              <div className="font-medium text-[#111827]">{destinationLocation?.name || '—'}</div>
            </div>
          </div>

          {/* Items to Transfer */}
          <div>
            <Label className="block mb-2">Items to Transfer</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map(item => {
                const qtyTransferring = transferQtys[item.id] || 0;
                
                return (
                  <Card key={item.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#111827]">{item.item_name || 'Item'}</p>
                          {item.quantity_required && (
                            <div className="text-xs text-[#6B7280] mt-1">
                              Required: {item.quantity_required}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Qty to Transfer</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={qtyTransferring}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0);
                              setTransferQtys(prev => ({
                                ...prev,
                                [item.id]: val
                              }));
                            }}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Items moved for job completion"
              className="min-h-[80px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {transferMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Transfer Items
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}