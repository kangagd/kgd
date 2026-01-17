import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function TransferStockModal({ open, onOpenChange, vehicleId, isTechnician = false }) {
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState("warehouse_to_vehicle");
  const [notes, setNotes] = useState("");
  const [maxAvailable, setMaxAvailable] = useState(0);

  // Guard: return early if no vehicleId
  if (!vehicleId) {
    return null;
  }

  // Fetch all active price list items (tracked inventory only)
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.filter({ 
      is_active: { $ne: false },
      track_inventory: { $ne: false }
    })
  });

  // Fetch vehicle and warehouse locations
  const { data: locationData = {} } = useQuery({
    queryKey: ['vehicleWarehouseLocations', vehicleId],
    queryFn: async () => {
      const vehicle = await base44.entities.Vehicle.get(vehicleId);
      
      const vehicleLocs = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicleId,
        is_active: { $ne: false }
      });

      const warehouses = await base44.entities.InventoryLocation.filter({
        type: 'warehouse',
        is_active: { $ne: false }
      });

      return {
        vehicle,
        vehicleLoc: vehicleLocs[0] || null,
        warehouseLoc: warehouses[0] || null
      };
    },
    enabled: open && !!vehicleId
  });

  // Fetch current stock quantities for all items at warehouse
  const { data: allWarehouseQties = [] } = useQuery({
    queryKey: ['warehouseQuantities', locationData.warehouseLoc?.id],
    queryFn: async () => {
      if (!locationData.warehouseLoc) return [];
      
      return await base44.entities.InventoryQuantity.filter({
        location_id: locationData.warehouseLoc.id
      });
    },
    enabled: !!locationData.warehouseLoc
  });

  // Fetch current stock quantities for selected item
  const { data: quantities = {} } = useQuery({
    queryKey: ['itemQuantities', selectedItemId, locationData.vehicleLoc?.id, locationData.warehouseLoc?.id],
    queryFn: async () => {
      if (!selectedItemId || !locationData.vehicleLoc || !locationData.warehouseLoc) return {};

      const vehicleQty = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: selectedItemId,
        location_id: locationData.vehicleLoc.id
      });

      const warehouseQty = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: selectedItemId,
        location_id: locationData.warehouseLoc.id
      });

      return {
        vehicleQty: vehicleQty[0]?.quantity || 0,
        warehouseQty: warehouseQty[0]?.quantity || 0
      };
    },
    enabled: !!selectedItemId && !!locationData.vehicleLoc && !!locationData.warehouseLoc
  });

  // Update max available based on direction
  React.useEffect(() => {
    if (direction === 'warehouse_to_vehicle') {
      setMaxAvailable(quantities.warehouseQty || 0);
    } else {
      setMaxAvailable(quantities.vehicleQty || 0);
    }
  }, [direction, quantities]);

  const selectedItem = useMemo(() => 
    priceListItems.find(i => i.id === selectedItemId), 
    [selectedItemId, priceListItems]
  );

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItemId || !quantity || parseFloat(quantity) <= 0) {
        throw new Error('Please select an item and quantity');
      }

      if (parseFloat(quantity) > maxAvailable) {
        throw new Error(`Insufficient stock. Available: ${maxAvailable}`);
      }

      if (!locationData.vehicleLoc || !locationData.warehouseLoc) {
        throw new Error('Location configuration error');
      }

      const fromLocationId = direction === 'warehouse_to_vehicle' 
        ? locationData.warehouseLoc.id 
        : locationData.vehicleLoc.id;
      
      const toLocationId = direction === 'warehouse_to_vehicle' 
        ? locationData.vehicleLoc.id 
        : locationData.warehouseLoc.id;

      const response = await base44.functions.invoke('moveInventory', {
        priceListItemId: selectedItemId,
        fromLocationId,
        toLocationId,
        quantity: parseFloat(quantity),
        source: 'transfer',
        vehicleId,
        notes: notes || null
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Transfer failed');
      }

      return response.data;
    },
    onSuccess: (data) => {
      const directionLabel = direction === 'warehouse_to_vehicle' ? 'to vehicle' : 'to warehouse';
      toast.success(`Transferred ${quantity} × ${selectedItem?.item} ${directionLabel}`);
      
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['vehicleMovements', vehicleId] });
      
      onOpenChange(false);
      setSelectedItemId("");
      setQuantity("");
      setNotes("");
      setDirection("warehouse_to_vehicle");
    },
    onError: (error) => {
      toast.error(error.message || 'Transfer failed');
    }
  });

  const isValid = selectedItemId && quantity && parseFloat(quantity) > 0 && parseFloat(quantity) <= maxAvailable;

  if (!locationData.vehicleLoc || !locationData.warehouseLoc) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Vehicle or warehouse location not configured. Contact admin.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transfer Stock: {locationData.vehicle?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direction Toggle - Only show for technicians, fixed for others */}
          {isTechnician && (
            <div>
              <Label className="mb-2 block text-sm font-medium">Direction</Label>
              <div className="flex gap-2">
                <Button
                  variant={direction === 'warehouse_to_vehicle' ? 'default' : 'outline'}
                  onClick={() => setDirection('warehouse_to_vehicle')}
                  className={direction === 'warehouse_to_vehicle' ? 'bg-[#FAE008] text-[#111827]' : ''}
                >
                  Warehouse → Vehicle
                </Button>
                <Button
                  variant={direction === 'vehicle_to_warehouse' ? 'default' : 'outline'}
                  onClick={() => setDirection('vehicle_to_warehouse')}
                  className={direction === 'vehicle_to_warehouse' ? 'bg-[#FAE008] text-[#111827]' : ''}
                >
                  Vehicle → Warehouse
                </Button>
              </div>
            </div>
          )}

          {/* Stock Availability Summary */}
          <Card className="p-3 bg-slate-50 border-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600 text-xs font-medium mb-1">Warehouse</div>
                <div className="text-xl font-semibold text-gray-900">{quantities.warehouseQty || 0}</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs font-medium mb-1">Vehicle</div>
                <div className="text-xl font-semibold text-gray-900">{quantities.vehicleQty || 0}</div>
              </div>
            </div>
          </Card>

          {/* Item Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Item to Transfer *</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {priceListItems
                  .map(item => {
                    const warehouseQty = allWarehouseQties.find(q => q.price_list_item_id === item.id)?.quantity || 0;
                    return { ...item, warehouseQty };
                  })
                  .filter(item => item.warehouseQty > 0)
                  .map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2">
                      <span>{item.item}</span>
                      {item.sku && <span className="text-xs text-gray-500">({item.sku})</span>}
                      <span className="text-xs text-green-600 font-medium">In stock: {item.warehouseQty}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Quantity *
              {maxAvailable > 0 && (
                <span className="text-xs text-gray-500 ml-2">
                  Available: {maxAvailable}
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="0"
              max={maxAvailable}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="text-lg font-medium"
            />
            {quantity && parseFloat(quantity) > maxAvailable && (
              <div className="mt-1 text-xs text-red-600">
                Exceeds available stock ({maxAvailable})
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Regular restock, emergency supply..."
              className="min-h-[60px] text-sm"
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
              onClick={() => transferMutation.mutate()}
              disabled={!isValid || transferMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {transferMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}