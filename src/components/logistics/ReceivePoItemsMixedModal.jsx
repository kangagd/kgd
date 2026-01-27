import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tantml:react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { invalidatePurchaseOrderBundle } from "@/components/api/invalidate";

export default function ReceivePoItemsMixedModal({ 
  open, 
  onOpenChange, 
  poId, 
  poReference, 
  lineItems = [],
  jobId = null 
}) {
  const queryClient = useQueryClient();
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveTime, setReceiveTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState("");
  const [selectedLines, setSelectedLines] = useState({});
  const [receiveQtys, setReceiveQtys] = useState({});

  // Fetch active warehouse/vehicle locations
  const { data: locations = [] } = useQuery({
    queryKey: ['activeReceiveLocations'],
    queryFn: async () => {
      const locs = await base44.entities.InventoryLocation.filter({
        is_active: true
      });
      return locs.filter(l => l.type === 'warehouse' || l.type === 'vehicle');
    },
    enabled: open
  });

  // Fetch PriceListItems to determine which lines are inventory-tracked
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
    enabled: open,
    staleTime: 120_000
  });

  // Fetch Parts to determine which non-SKU lines are project parts
  const { data: allParts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: () => base44.entities.Part.list(),
    enabled: open,
    staleTime: 60_000
  });

  // Classify lines
  const classifiedLines = useMemo(() => {
    return lineItems.map(line => {
      const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
      
      // Check if inventory-tracked SKU
      if (line.price_list_item_id) {
        const priceListItem = priceListItems.find(p => p.id === line.price_list_item_id);
        const isTracked = priceListItem?.track_inventory !== false;
        
        if (isTracked) {
          return { 
            ...line, 
            remaining,
            lineType: 'STOCK_SKU',
            typeLabel: 'Stock (SKU)',
            typeBadgeClass: 'bg-blue-100 text-blue-800',
            outcomePreview: destinationLocationId 
              ? `Stock will increase at ${locations.find(l => l.id === destinationLocationId)?.name || 'selected location'}` 
              : 'Requires destination location'
          };
        } else {
          return {
            ...line,
            remaining,
            lineType: 'NON_STOCK',
            typeLabel: 'Non-stock',
            typeBadgeClass: 'bg-gray-100 text-gray-700',
            outcomePreview: 'PO line will be marked received (no stock change)'
          };
        }
      }

      // Check if linked to a Part
      const linkedPart = allParts.find(p => p.po_line_id === line.id);
      if (linkedPart) {
        return {
          ...line,
          remaining,
          lineType: 'PROJECT_PART',
          typeLabel: 'Project Part',
          typeBadgeClass: 'bg-purple-100 text-purple-800',
          outcomePreview: 'Part status will update (no stock change)'
        };
      }

      // Default to NON_STOCK
      return {
        ...line,
        remaining,
        lineType: 'NON_STOCK',
        typeLabel: 'Non-stock',
        typeBadgeClass: 'bg-gray-100 text-gray-700',
        outcomePreview: 'PO line will be marked received (no stock change)'
      };
    });
  }, [lineItems, priceListItems, allParts, destinationLocationId, locations]);

  // Initialize selections and quantities
  useEffect(() => {
    if (classifiedLines.length > 0 && open) {
      const initialSelected = {};
      const initialQtys = {};
      
      classifiedLines.forEach(line => {
        const hasRemaining = line.remaining > 0;
        initialSelected[line.id] = hasRemaining;
        initialQtys[line.id] = hasRemaining ? line.remaining : 0;
      });
      
      setSelectedLines(initialSelected);
      setReceiveQtys(initialQtys);
      
      // Set default location (Main Warehouse)
      const mainWh = locations.find(l => l.type === 'warehouse' && l.name?.toLowerCase().includes('main'));
      if (mainWh) {
        setDestinationLocationId(mainWh.id);
      } else if (locations.length > 0) {
        setDestinationLocationId(locations[0].id);
      }
    }
  }, [open, classifiedLines, locations]);

  // Validation
  const selectedStockSkuLines = classifiedLines.filter(l => 
    selectedLines[l.id] && receiveQtys[l.id] > 0 && l.lineType === 'STOCK_SKU'
  );
  
  const selectedNonStockLines = classifiedLines.filter(l => 
    selectedLines[l.id] && receiveQtys[l.id] > 0 && l.lineType !== 'STOCK_SKU'
  );
  
  const totalSelected = selectedStockSkuLines.length + selectedNonStockLines.length;
  
  const needsDestination = selectedStockSkuLines.length > 0;
  const isValid = totalSelected > 0 && (!needsDestination || destinationLocationId);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const linesToReceive = classifiedLines
        .filter(line => selectedLines[line.id] && receiveQtys[line.id] > 0)
        .map(line => ({
          po_line_id: line.id,
          receive_qty: receiveQtys[line.id]
        }));

      const response = await base44.functions.invoke('receivePoItemsMixed', {
        purchase_order_id: poId,
        job_id: jobId,
        destination_location_id: destinationLocationId || null,
        received_at: `${receiveDate}T${receiveTime}:00Z`,
        notes: notes || null,
        lines: linesToReceive
      });

      return response.data;
    },
    onSuccess: (data) => {
      // Show detailed results
      if (!data.success) {
        const reasons = data.skipped_lines?.map(s => s.reason).join('; ') || 'Unknown error';
        toast.error(`Failed to receive items: ${reasons}`);
        return;
      }

      let message = `Received ${data.items_received} item(s)`;
      if (data.inventory_receipts > 0) {
        message += ` (${data.inventory_receipts} into inventory)`;
      }
      if (data.warnings?.length > 0) {
        toast.warning(message, {
          description: data.warnings.join('; ')
        });
      } else {
        toast.success(message);
      }

      // Invalidate queries
      invalidatePurchaseOrderBundle(queryClient, poId);
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      }

      // Reset and close
      setNotes("");
      setSelectedLines({});
      setReceiveQtys({});
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Failed to receive items: ${errorMsg}`);
    }
  });

  const handleReceive = () => {
    receiveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Receive Items</DialogTitle>
          <p className="text-sm text-[#6B7280] mt-1">
            Receiving updates PO received quantities. Only inventory-tracked SKU lines change stock.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Header row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Destination *</Label>
              <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
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
              <Label>Received Date/Time</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="time"
                  value={receiveTime}
                  onChange={(e) => setReceiveTime(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Damaged item, supplier note, etc."
              className="min-h-[60px]"
            />
          </div>

          {/* Lines table */}
          <div>
            <Label className="block mb-2 font-semibold">Items to Receive</Label>
            {selectedNonStockLines.length === totalSelected && totalSelected > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  No inventory stock will change from this receipt.
                </p>
              </div>
            )}
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] sticky top-0">
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-2 px-3 font-semibold text-[#111827] w-12">
                        <span className="text-xs">✅</span>
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-[#111827]">Item</th>
                      <th className="text-left py-2 px-3 font-semibold text-[#111827]">Type</th>
                      <th className="text-right py-2 px-3 font-semibold text-[#111827]">Ordered</th>
                      <th className="text-right py-2 px-3 font-semibold text-[#111827]">Received</th>
                      <th className="text-right py-2 px-3 font-semibold text-[#111827]">Remaining</th>
                      <th className="text-right py-2 px-3 font-semibold text-[#111827]">Receive Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classifiedLines.map((line) => {
                      const isSelected = selectedLines[line.id];
                      const qtyReceiving = receiveQtys[line.id] || 0;
                      
                      return (
                        <tr 
                          key={line.id} 
                          className={`border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors ${
                            isSelected ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                setSelectedLines(prev => ({ ...prev, [line.id]: checked }))
                              }
                              disabled={line.remaining <= 0}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-[#111827]">{line.item_name}</div>
                            {isSelected && qtyReceiving > 0 && (
                              <div className="text-xs text-[#6B7280] mt-1">
                                {line.outcomePreview}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={`${line.typeBadgeClass} text-xs font-medium`}>
                              {line.typeLabel}
                            </Badge>
                          </td>
                          <td className="text-right py-2 px-3 text-[#6B7280]">
                            {line.qty_ordered || 0}
                          </td>
                          <td className="text-right py-2 px-3 text-[#6B7280]">
                            {line.qty_received || 0}
                          </td>
                          <td className="text-right py-2 px-3 font-medium text-[#111827]">
                            {line.remaining}
                          </td>
                          <td className="text-right py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              max={line.remaining}
                              value={qtyReceiving}
                              onChange={(e) => {
                                const val = Math.min(
                                  Math.max(0, parseFloat(e.target.value) || 0),
                                  line.remaining
                                );
                                setReceiveQtys(prev => ({ ...prev, [line.id]: val }));
                                // Auto-select line if qty > 0
                                if (val > 0 && !isSelected) {
                                  setSelectedLines(prev => ({ ...prev, [line.id]: true }));
                                }
                              }}
                              disabled={!isSelected || line.remaining <= 0}
                              className="w-20 text-right h-8"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-2 text-xs text-[#6B7280] space-y-1">
              <p>💡 Completing a logistics job does not move stock. Receiving does.</p>
              {!isValid && totalSelected === 0 && (
                <p className="text-amber-600">Select at least one line with Receive now &gt; 0</p>
              )}
              {needsDestination && !destinationLocationId && (
                <p className="text-amber-600">Inventory-tracked items require a destination location</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-[#E5E7EB] pt-4 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={receiveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReceive}
            disabled={!isValid || receiveMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {receiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Receive Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}