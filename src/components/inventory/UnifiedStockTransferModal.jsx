/**
 * UNIFIED TRANSFER MODAL
 * Used from:
 * - Warehouse inventory (warehouse ↔ vehicle)
 * - My Vehicle (vehicle ↔ warehouse)
 * - Price List SKU detail (warehouse ↔ vehicle)
 * 
 * Handles all stock transfers via transferInventoryLocation backend function
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowRight, AlertCircle, Loader2, Package } from 'lucide-react';
import { getPhysicalAvailableLocations, normalizeLocationType } from '@/components/utils/inventoryLocationUtils';

export default function UnifiedStockTransferModal({
  open,
  onClose,
  skuId,
  skuName,
  defaultFromLocationId = null,
  defaultToLocationId = null,
  onSuccess = null,
}) {
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch all locations
  const { data: allLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => base44.entities.InventoryLocation.filter({}),
    staleTime: 60000,
    enabled: open,
  });

  // Filter to physical available locations only
  const locations = useMemo(() => 
    getPhysicalAvailableLocations(allLocations),
    [allLocations]
  );

  // Fetch quantities for selected SKU
  const { data: quantities = [] } = useQuery({
    queryKey: ['inventory-quantities', skuId],
    queryFn: () => base44.entities.InventoryQuantity.filter({ price_list_item_id: skuId }),
    staleTime: 30000,
    enabled: open && !!skuId,
  });

  // Set defaults on mount or when modal opens
  useEffect(() => {
    if (open) {
      if (defaultFromLocationId) setFromLocationId(defaultFromLocationId);
      if (defaultToLocationId) setToLocationId(defaultToLocationId);
      setQuantity('');
      setNotes('');
    }
  }, [open, defaultFromLocationId, defaultToLocationId]);

  // Get available quantity at from location
  const availableQty = useMemo(() => {
    if (!fromLocationId) return 0;
    const qty = quantities.find(q => q.location_id === fromLocationId);
    return qty?.quantity || 0;
  }, [fromLocationId, quantities]);

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantity);
      
      if (!fromLocationId || !toLocationId) {
        throw new Error('Please select both from and to locations');
      }
      if (fromLocationId === toLocationId) {
        throw new Error('From and to locations must be different');
      }
      if (!qty || qty <= 0) {
        throw new Error('Please enter a valid quantity');
      }
      if (qty > availableQty) {
        throw new Error(`Insufficient stock. Available: ${availableQty}`);
      }

      const response = await base44.functions.invoke('recordStockMovement', {
        priceListItemId: skuId,
        fromLocationId,
        toLocationId,
        quantity: qty,
        movementType: 'transfer',
        reference_type: 'transfer',
        notes: notes || `Transfer from ${locations.find(l => l.id === fromLocationId)?.name} to ${locations.find(l => l.id === toLocationId)?.name}`,
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      queryClient.invalidateQueries({ queryKey: ['vehicleStock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      
      toast.success('Stock transferred successfully');
      
      if (onSuccess) onSuccess();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Transfer failed');
    },
  });

  const handleClose = () => {
    setFromLocationId('');
    setToLocationId('');
    setQuantity('');
    setNotes('');
    onClose();
  };

  const isValid =
    fromLocationId &&
    toLocationId &&
    quantity &&
    parseFloat(quantity) > 0 &&
    parseFloat(quantity) <= availableQty &&
    fromLocationId !== toLocationId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FAE008]" />
            Transfer Stock
          </DialogTitle>
          {skuName && (
            <DialogDescription>
              {skuName}
            </DialogDescription>
          )}
        </DialogHeader>

        {locationsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* From Location */}
            <div className="space-y-2">
              <Label htmlFor="from-location">From Location *</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger id="from-location">
                  <SelectValue placeholder="Select source location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => {
                    const stock = quantities.find(q => q.location_id === loc.id)?.quantity || 0;
                    return (
                      <SelectItem key={loc.id} value={loc.id} disabled={stock === 0}>
                        {loc.name} ({stock} in stock)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fromLocationId && (
                <p className="text-[12px] text-[#6B7280]">
                  Available: {availableQty} units
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center pt-2 pb-2">
              <ArrowRight className="w-6 h-6 text-[#9CA3AF]" />
            </div>

            {/* To Location */}
            <div className="space-y-2">
              <Label htmlFor="to-location">To Location *</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger id="to-location">
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((loc) => loc.id !== fromLocationId)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                disabled={!fromLocationId}
              />
              {quantity && parseFloat(quantity) > availableQty && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700">
                    Insufficient stock. Available: {availableQty}
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this transfer..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={transferMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!isValid || transferMutation.isPending}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              'Transfer Stock'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}