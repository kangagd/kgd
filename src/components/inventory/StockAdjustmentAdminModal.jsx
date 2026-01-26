/**
 * STOCK ADJUSTMENT MODAL (Admin-only)
 * Used from:
 * - Warehouse inventory
 * - My Vehicle inventory  
 * - Price List SKU detail
 * 
 * Handles adjustment via recordStockMovement with negative/positive quantity
 */

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StockAdjustmentAdminModal({
  open,
  onClose,
  skuId,
  skuName,
  locationId,
  locationName,
  currentQuantity = 0,
  onSuccess = null,
}) {
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setAdjustmentQty('');
      setReason('');
    }
  }, [open]);

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(adjustmentQty);

      if (!skuId || !locationId) {
        throw new Error('Missing SKU or location');
      }
      if (!reason || reason.trim().length === 0) {
        throw new Error('Reason is required for adjustments');
      }
      if (isNaN(qty)) {
        throw new Error('Please enter a valid adjustment quantity');
      }

      // qty can be + or -, allow it
      const response = await base44.functions.invoke('adjustStockCorrection', {
        price_list_item_id: skuId,
        location_id: locationId,
        adjustment_quantity: qty,
        reason: reason,
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

      toast.success('Stock adjustment recorded');

      if (onSuccess) onSuccess();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Adjustment failed');
    },
  });

  const handleClose = () => {
    setAdjustmentQty('');
    setReason('');
    onClose();
  };

  const isValid = adjustmentQty && !isNaN(parseFloat(adjustmentQty)) && reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Adjust Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* SKU + Location display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            {skuName && (
              <div className="text-[13px]">
                <span className="text-[#6B7280]">SKU:</span>{' '}
                <span className="font-semibold text-[#111827]">{skuName}</span>
              </div>
            )}
            {locationName && (
              <div className="text-[13px]">
                <span className="text-[#6B7280]">Location:</span>{' '}
                <span className="font-semibold text-[#111827]">{locationName}</span>
              </div>
            )}
            <div className="text-[13px]">
              <span className="text-[#6B7280]">Current:</span>{' '}
              <span className="font-semibold text-[#111827]">{Math.round(currentQuantity)}</span>
            </div>
          </div>

          {/* Adjustment Quantity */}
          <div className="space-y-2">
            <Label htmlFor="adj-qty">
              Adjustment Qty * (positive or negative)
            </Label>
            <Input
              id="adj-qty"
              type="number"
              step="0.1"
              value={adjustmentQty}
              onChange={(e) => setAdjustmentQty(e.target.value)}
              placeholder="e.g., 5 or -2"
            />
            <p className="text-[12px] text-[#6B7280]">
              Result will be: {(currentQuantity + (parseFloat(adjustmentQty) || 0)).toFixed(1)}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Found extra stock, damaged item, inventory discrepancy..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700">
              Adjustments are permanent and auditable. Ensure accuracy before confirming.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={adjustMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => adjustMutation.mutate()}
            disabled={!isValid || adjustMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {adjustMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Confirm Adjustment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}