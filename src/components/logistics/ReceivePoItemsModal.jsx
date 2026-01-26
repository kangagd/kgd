import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function ReceivePoItemsModal({ open, onOpenChange, poId, poReference, lineItems = [] }) {
  const queryClient = useQueryClient();
  const [receiveLocation, setReceiveLocation] = useState("");
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveTime, setReceiveTime] = useState(new Date().toTimeString().slice(0, 5));
  const [markPoAsReceived, setMarkPoAsReceived] = useState(false);
  const [notes, setNotes] = useState("");
  const [receiveQtys, setReceiveQtys] = useState({});

  // Fetch active inventory locations
  const { data: locations = [] } = useQuery({
    queryKey: ['activeInventoryLocations'],
    queryFn: async () => {
      const locs = await base44.entities.InventoryLocation.filter({
        is_active: true
      });
      return locs;
    }
  });

  // Initialize receive quantities to remaining for each line
  useEffect(() => {
    if (lineItems.length > 0 && open) {
      const initial = {};
      lineItems.forEach(line => {
        const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
        initial[line.id] = remaining > 0 ? remaining : 0;
      });
      setReceiveQtys(initial);
      
      // Set default location (Main Warehouse)
      const mainWh = locations.find(l => l.type === 'warehouse' && l.name?.toLowerCase().includes('main'));
      if (mainWh) {
        setReceiveLocation(mainWh.id);
      } else if (locations.length > 0) {
        setReceiveLocation(locations[0].id);
      }
    }
  }, [open, lineItems, locations]);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!receiveLocation) {
        throw new Error('Receive location is required');
      }

      const receiveDateTime = `${receiveDate}T${receiveTime}:00Z`;
      const itemsToReceive = lineItems
        .filter(line => receiveQtys[line.id] > 0)
        .map(line => ({
          po_line_id: line.id,
          qty_received: receiveQtys[line.id]
        }));

      if (itemsToReceive.length === 0) {
        throw new Error('Please enter quantities to receive for at least one item');
      }

      const jobId = window.location.search.includes('jobId=') 
        ? new URLSearchParams(window.location.search).get('jobId') 
        : null;
      
      const response = await base44.functions.invoke('receivePoItems', {
        po_id: poId,
        job_id: jobId,
        reference_type: jobId ? 'purchase_order' : undefined,
        location_id: receiveLocation,
        receive_date_time: receiveDateTime,
        items: itemsToReceive,
        mark_po_received: markPoAsReceived,
        notes: notes
      });

      // Check if operation fully failed (all items skipped)
      if (!response.data?.success) {
        const skipReasons = response.data?.skipped_lines?.map(s => `${s.po_line_id}: ${s.reason}`).join(', ') || 'unknown';
        throw new Error(response.data?.error || `Failed to receive any items. ${skipReasons}`);
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Show success with warning if items were skipped
      if (data.skipped_items > 0) {
        toast.warning(
          `Received ${data.items_received} items. ${data.skipped_items} skipped: ${
            data.skipped_lines?.map(s => s.reason).join('; ') || 'see details'
          }`
        );
      } else {
        toast.success(`Received ${data.items_received} items`);
      }
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrderLines', poId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      onOpenChange(false);
      
      // Reset form
      setNotes("");
      setMarkPoAsReceived(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to receive items');
    }
  });

  const handleReceive = () => {
    receiveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Items from PO {poReference}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Receive Location *</Label>
              <Select value={receiveLocation} onValueChange={setReceiveLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Receive Date *</Label>
              <Input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Receive Time *</Label>
            <Input
              type="time"
              value={receiveTime}
              onChange={(e) => setReceiveTime(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div>
            <Label className="block mb-2">Items to Receive</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lineItems.map(line => {
                const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
                const qtyReceiving = receiveQtys[line.id] || 0;
                
                return (
                  <Card key={line.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#111827]">{line.item_name}</p>
                          <div className="flex gap-3 mt-1 text-xs text-[#6B7280]">
                            <span>Ordered: {line.qty_ordered || 0}</span>
                            <span>Received: {line.qty_received || 0}</span>
                            <span className="font-medium">Remaining: {remaining}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Qty Receiving Now</Label>
                          <Input
                            type="number"
                            min="0"
                            max={remaining}
                            value={qtyReceiving}
                            onChange={(e) => {
                              const val = Math.min(
                                Math.max(0, parseFloat(e.target.value) || 0),
                                remaining
                              );
                              setReceiveQtys(prev => ({
                                ...prev,
                                [line.id]: val
                              }));
                            }}
                            className="h-8"
                          />
                        </div>
                        {qtyReceiving === remaining && remaining > 0 && (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2 p-3 bg-[#F9FAFB] rounded-lg">
            <Checkbox
              checked={markPoAsReceived}
              onCheckedChange={setMarkPoAsReceived}
              id="mark-received"
            />
            <Label htmlFor="mark-received" className="text-sm cursor-pointer">
              Mark PO as Received when all items are fully received
            </Label>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Damaged item, missing SKU, etc."
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
              onClick={handleReceive}
              disabled={receiveMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {receiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Receive Items
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}