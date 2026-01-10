import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowRight, AlertCircle } from 'lucide-react';

export default function StockTransferModal({ open, onClose, item }) {
  const queryClient = useQueryClient();
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data: locations = [] } = useQuery({
    queryKey: ['inventoryLocations'],
    queryFn: () => base44.entities.InventoryLocation.filter({}, '-name'),
    staleTime: 60000,
    enabled: open
  });

  const { data: quantities = [] } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
    staleTime: 60000,
    enabled: open
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('transferInventoryLocation', {
        from_location_id: fromLocation,
        to_location_id: toLocation,
        price_list_item_id: item.price_list_item_id,
        quantity: parseInt(quantity),
        reason: reason || 'Stock transfer'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      toast.success('Stock transferred successfully');
      setFromLocation('');
      setToLocation('');
      setQuantity('');
      setReason('');
      onClose();
    },
    onError: (error) => {
      toast.error(`Transfer failed: ${error.message}`);
    }
  });

  const fromLocationQty = fromLocation
    ? quantities.find(q => q.location_id === fromLocation && q.price_list_item_id === item.price_list_item_id)?.quantity || 0
    : 0;

  const isValid = fromLocation && toLocation && quantity && parseInt(quantity) > 0 && parseInt(quantity) <= fromLocationQty;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
          <DialogDescription>
            Transfer {item?.item_name} between locations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* FROM LOCATION */}
          <div>
            <label className="block text-[13px] font-medium text-[#4B5563] mb-2">
              From Location
            </label>
            <Select value={fromLocation} onValueChange={setFromLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select source location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromLocation && (
              <p className="text-[12px] text-[#6B7280] mt-2">
                Available: <strong>{fromLocationQty}</strong> units
              </p>
            )}
          </div>

          {/* QUANTITY */}
          <div>
            <label className="block text-[13px] font-medium text-[#4B5563] mb-2">
              Quantity to Transfer
            </label>
            <Input
              type="number"
              min="1"
              max={fromLocationQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className="text-[14px]"
            />
          </div>

          {/* TO LOCATION */}
          <div>
            <label className="block text-[13px] font-medium text-[#4B5563] mb-2">
              To Location
            </label>
            <Select value={toLocation} onValueChange={setToLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id} disabled={loc.id === fromLocation}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* REASON */}
          <div>
            <label className="block text-[13px] font-medium text-[#4B5563] mb-2">
              Reason (Optional)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Restock vehicle"
              className="text-[14px]"
            />
          </div>

          {/* VALIDATION */}
          {quantity && parseInt(quantity) > fromLocationQty && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">
                Insufficient quantity. Available: {fromLocationQty}
              </p>
            </div>
          )}

          {/* PREVIEW */}
          {fromLocation && toLocation && quantity && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[12px] text-blue-700">
                <strong>Transfer preview:</strong> {quantity} units from {locations.find(l => l.id === fromLocation)?.name} to {locations.find(l => l.id === toLocation)?.name}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!isValid || transferMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {transferMutation.isPending ? 'Transferring...' : 'Transfer Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}