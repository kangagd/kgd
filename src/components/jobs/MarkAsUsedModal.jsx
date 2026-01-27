import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Loader2, Check } from "lucide-react";

export default function MarkAsUsedModal({ item, job, open, onClose }) {
  const [qtyUsed, setQtyUsed] = useState(String(item?.qty || 1));
  const [locationId, setLocationId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedPriceListItemId, setResolvedPriceListItemId] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  const queryClient = useQueryClient();

  // Resolver: determine inventory lookup ID from requirement item
  useEffect(() => {
    if (!open || !item) {
      setResolvedPriceListItemId(null);
      setResolveError(null);
      return;
    }

    const resolveId = async () => {
      setIsResolving(true);
      setResolveError(null);

      try {
        let priceListItemId = null;

        // Check if already has price_list_item_id
        if (item.price_list_item_id) {
          priceListItemId = item.price_list_item_id;
        }
        // If part reference, fetch Part to get price_list_item_id
        else if (item.type === 'part' && item.ref_id) {
          try {
            const part = await base44.entities.Part.get(item.ref_id);
            priceListItemId = part?.price_list_item_id;
          } catch (err) {
            console.warn('Could not fetch Part:', err);
            priceListItemId = null;
          }
        }
        // If direct ref_id and not a part, assume it's price_list_item_id
        else if (item.ref_id && item.type !== 'part') {
          priceListItemId = item.ref_id;
        }

        if (priceListItemId) {
          setResolvedPriceListItemId(priceListItemId);
          setResolveError(null);
        } else {
          // Custom item or no mapping
          setResolvedPriceListItemId(null);
          setResolveError('stock_tracking_unavailable');
        }
      } catch (err) {
        console.error('Error resolving price list item ID:', err);
        setResolvedPriceListItemId(null);
        setResolveError('resolve_failed');
      } finally {
        setIsResolving(false);
      }
    };

    resolveId();
  }, [open, item]);

  // Fetch inventory locations with stock (only when resolved ID is available)
  const { data: availableLocations = [] } = useQuery({
    queryKey: ['inventory-locations-for-item', resolvedPriceListItemId],
    queryFn: async () => {
      if (!resolvedPriceListItemId) return [];

      const quantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: resolvedPriceListItemId
      });
      const allLocations = await base44.entities.InventoryLocation.list();
      const locationMap = new Map(allLocations.map(loc => [loc.id, loc]));

      const locationsWithStock = [];
      for (const qty of quantities) {
        const qtyValue = qty.quantity ?? 0;
        if (qtyValue > 0) {
          const location = locationMap.get(qty.location_id);
          if (location && location.is_active !== false) {
            locationsWithStock.push({
              ...location,
              available_quantity: qtyValue,
            });
          }
        }
      }
      return locationsWithStock;
    },
    enabled: open && !!resolvedPriceListItemId && !isResolving,
  });

  // Auto-suggest location (technician's vehicle if available)
  const suggestedLocationId = useMemo(() => {
    if (!job?.assigned_to?.[0]) return "";
    // Try to find the technician's vehicle location
    // For now, return empty to require explicit selection
    // In future, could query for Vehicle and its InventoryLocation
    return "";
  }, [job?.assigned_to]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const qty = Number(qtyUsed);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    // If stock-tracked, require location; if not, skip stock movement
    if (resolvedPriceListItemId && !locationId) {
      toast.error("Please select a source location");
      return;
    }

    const selectedLocation = availableLocations.find(loc => loc.id === locationId);
    if (selectedLocation && qty > selectedLocation.available_quantity) {
      toast.error(`Insufficient stock. Only ${selectedLocation.available_quantity} available.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // If stock-tracked, record inventory deduction
      if (resolvedPriceListItemId) {
        await base44.functions.invoke('moveInventory', {
          priceListItemId: resolvedPriceListItemId,
          fromLocationId: locationId,
          toLocationId: null,
          quantity: qty,
          source: 'job_usage',
          jobId: job.id,
          notes: `Mark as used: ${item.label} on ${job.job_number || 'Job'}`
        });
      }

      // Update requirement item with used tracking
      const updatedItem = {
        ...item,
        used: true,
        used_qty: qty,
        used_at: new Date().toISOString(),
        used_by: 'technician', // or fetch current user email
        status: 'installed' // Mark as installed once used
      };

      // Update visit_covers_items or job.visit_scope
      try {
        if (job.activeVisit) {
          await base44.functions.invoke('manageVisit', {
            action: 'update',
            visit_id: job.activeVisit.id,
            data: {
              visit_covers_items: (job.activeVisit.visit_covers_items || []).map(i =>
                i.key === item.key ? updatedItem : i
              )
            }
          });
        } else {
          await base44.functions.invoke('manageJob', {
            action: 'update',
            id: job.id,
            data: {
              visit_scope: (job.visit_scope || []).map(i =>
                i.key === item.key ? updatedItem : i
              )
            }
          });
        }
      } catch (err) {
        console.warn('Could not update job/visit scope:', err);
        // Don't fail the whole operation if scope update fails
      }

      // If item is linked to a PO line, update it to "installed"
      if (item.ref_id && job.project_id) {
        try {
          const poLines = await base44.entities.PurchaseOrderLine.filter({
            product_id: item.ref_id
          });
          if (poLines.length > 0) {
            await Promise.all(
              poLines.map(line =>
                base44.entities.PurchaseOrderLine.update(line.id, { status: 'installed' })
              )
            );
          }
        } catch (err) {
          console.warn('Could not update PO line status:', err);
        }
      }

      toast.success(`Marked "${item.label}" as used (${qty} qty)`);
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      onClose();
    } catch (error) {
      console.error("Error marking as used:", error);
      toast.error(error.message || "Failed to mark as used");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Mark as Used: {item?.label}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Qty Used */}
          <div className="space-y-2">
            <Label>Quantity Used</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={qtyUsed}
              onChange={(e) => setQtyUsed(e.target.value)}
              placeholder="1"
            />
            {item?.qty && (
              <p className="text-xs text-gray-500">Required qty: {item.qty}</p>
            )}
          </div>

          {/* Source Location */}
          <div className="space-y-2">
            <Label>Source Location</Label>
            {isResolving ? (
              <div className="flex items-center justify-center p-4 text-gray-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-sm">Looking up inventory...</span>
              </div>
            ) : resolveError === 'stock_tracking_unavailable' ? (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">No stock tracking available for this item. Manually select deduction location below.</p>
              </div>
            ) : resolveError === 'resolve_failed' ? (
              <div className="flex items-start gap-2 text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">Failed to resolve item inventory. Please try again or contact support.</p>
              </div>
            ) : (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {availableLocations.length === 0 ? (
                    <div className="p-2 text-center text-sm text-gray-500">
                      No stock available in any location
                    </div>
                  ) : (
                    availableLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} - {location.available_quantity} available
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview */}
          {locationId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                This will deduct <strong>{qtyUsed}</strong> from{" "}
                <strong>{availableLocations.find(l => l.id === locationId)?.name}</strong>
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !locationId}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Used
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}