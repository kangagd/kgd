import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PackageCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ReceivePurchaseOrderModal({ open, onClose, purchaseOrderId }) {
  const queryClient = useQueryClient();
  const [receipts, setReceipts] = useState({});

  // Fetch PO
  const { data: purchaseOrder } = useQuery({
    queryKey: ["purchase-order", purchaseOrderId],
    queryFn: () => base44.entities.PurchaseOrder.get(purchaseOrderId),
    enabled: !!purchaseOrderId && open,
  });

  // Fetch PO Lines
  const { data: lines = [] } = useQuery({
    queryKey: ["purchase-order-lines", purchaseOrderId],
    queryFn: () =>
      base44.entities.PurchaseOrderLine.filter({
        purchase_order_id: purchaseOrderId,
      }),
    enabled: !!purchaseOrderId && open,
  });

  // Initialize receipts state
  useEffect(() => {
    if (lines.length > 0 && open) {
      const initialReceipts = {};
      lines.forEach(line => {
        const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
        initialReceipts[line.id] = remaining > 0 ? remaining : 0;
      });
      setReceipts(initialReceipts);
    }
  }, [lines, open]);

  const handleReceiveChange = (lineId, value) => {
    setReceipts(prev => ({
      ...prev,
      [lineId]: value
    }));
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrder) return;
      const now = new Date().toISOString();
      const locationId = purchaseOrder.delivery_location_id || null;
      
      // Process each line
      const updates = lines.map(async (line) => {
        const receiveNow = parseFloat(receipts[line.id] || 0);
        const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);

        if (receiveNow <= 0 || remaining <= 0) return null;

        // Limit to remaining? Or allow over-receiving? 
        // Standard practice: usually allow over-receiving but warn. 
        // For simplicity based on prompt: "ActualReceive = Math.min(receiveNow, remaining)" logic suggested in prompt.
        // However, prompt says: "actualReceive = Math.min(receiveNow, remaining)"
        // I will stick to prompt logic to avoid logic errors.
        
        // NOTE: User instructions actually said: "actualReceive = Math.min(receiveNow, remaining);"
        // This prevents over-receiving.
        const actualReceive = Math.min(receiveNow, remaining);
        
        if (actualReceive <= 0) return null;

        // 1. Update PurchaseOrderLine
        await base44.entities.PurchaseOrderLine.update(line.id, {
          qty_received: (line.qty_received || 0) + actualReceive,
        });

        // 2. Create StockMovement
        if (locationId) {
            await base44.entities.StockMovement.create({
            price_list_item_id: line.price_list_item_id,
            location_id: locationId,
            movement_type: "purchase_in",
            qty: actualReceive,
            unit_cost_ex_tax: line.unit_cost_ex_tax || 0,
            reference_type: "purchase_order",
            reference_id: purchaseOrder.id,
            occurred_at: now,
            notes: `PO ${purchaseOrder.po_number || purchaseOrder.id} – received`,
            });
        }
        
        return actualReceive;
      });

      await Promise.all(updates);

      // After processing, update PO status
      // Need to re-fetch lines to get updated quantities? Or just calculate locally?
      // Better to fetch fresh state to be sure.
      const updatedLines = await base44.entities.PurchaseOrderLine.filter({
        purchase_order_id: purchaseOrderId,
      });

      const allReceived = updatedLines.every(
        (l) => (l.qty_received || 0) >= (l.qty_ordered || 0)
      );
      const anyReceived = updatedLines.some((l) => (l.qty_received || 0) > 0);

      let newStatus = purchaseOrder.status;
      if (allReceived) {
        newStatus = "received";
      } else if (anyReceived) {
        newStatus = "partially_received";
      }

      if (newStatus !== purchaseOrder.status) {
        await base44.entities.PurchaseOrder.update(purchaseOrder.id, {
          status: newStatus,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["purchase-order", purchaseOrderId]);
      queryClient.invalidateQueries(["purchase-order-lines", purchaseOrderId]);
      queryClient.invalidateQueries(["purchase-orders-by-supplier", purchaseOrder?.supplier_id]);
      toast.success("Stock received successfully");
      onClose();
    },
    onError: (err) => {
      console.error("Failed to receive stock:", err);
      toast.error("Failed to receive stock");
    }
  });

  if (!purchaseOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5" />
            Receive Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-3 rounded-lg border">
            <div>
              <div className="text-muted-foreground text-xs">Supplier</div>
              <div className="font-medium">{purchaseOrder.supplier_name || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">PO Number</div>
              <div className="font-medium">{purchaseOrder.po_number || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Delivery Location</div>
              <div className="font-medium">{purchaseOrder.delivery_location_name || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Status</div>
              <div className="capitalize font-medium">{purchaseOrder.status?.replace('_', ' ')}</div>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Item</TableHead>
                  <TableHead className="w-[15%]">Ordered</TableHead>
                  <TableHead className="w-[15%]">Received</TableHead>
                  <TableHead className="w-[15%]">Receive Now</TableHead>
                  <TableHead className="w-[15%]">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const remaining = Math.max(0, (line.qty_ordered || 0) - (line.qty_received || 0));
                  const receiveNow = receipts[line.id] || 0;
                  const isFullyReceived = remaining === 0;
                  
                  return (
                    <TableRow key={line.id} className={isFullyReceived ? "bg-slate-50 opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{line.description || "Item"}</div>
                        {isFullyReceived && <span className="text-xs text-green-600 font-medium">Fully Received</span>}
                      </TableCell>
                      <TableCell>{line.qty_ordered}</TableCell>
                      <TableCell>{line.qty_received || 0}</TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          min="0" 
                          max={remaining}
                          disabled={isFullyReceived}
                          value={receiveNow}
                          onChange={(e) => handleReceiveChange(line.id, e.target.value)}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell>
                        ${((parseFloat(receiveNow) || 0) * (line.unit_cost_ex_tax || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      No lines found for this order.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => receiveMutation.mutate()} 
            disabled={receiveMutation.isPending || lines.length === 0}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {receiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Receive Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}