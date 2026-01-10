import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ArrowRight, Loader2, Package } from "lucide-react";

export default function MoveStockModal({ isOpen, onClose, item, onSuccess }) {
  const [locations, setLocations] = useState([]);
  const [quantities, setQuantities] = useState([]);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (isOpen && item) {
      loadData();
    }
  }, [isOpen, item]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [locationsData, quantitiesData] = await Promise.all([
        base44.entities.InventoryLocation.filter({ is_active: true }),
        base44.entities.InventoryQuantity.filter({ price_list_item_id: item.id })
      ]);
      setLocations(locationsData);
      setQuantities(quantitiesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoadingData(false);
    }
  };

  const getLocationStock = (locationId) => {
    const qty = quantities.find(q => q.location_id === locationId);
    return qty?.quantity || 0;
  };

  const availableStock = fromLocationId ? getLocationStock(fromLocationId) : 0;

  const handleMove = async () => {
    if (!fromLocationId || !toLocationId) {
      toast.error('Please select both source and destination locations');
      return;
    }

    if (fromLocationId === toLocationId) {
      toast.error('Source and destination cannot be the same');
      return;
    }

    if (quantity <= 0 || quantity > availableStock) {
      toast.error(`Invalid quantity. Available: ${availableStock}`);
      return;
    }

    setIsMoving(true);
    try {
      const response = await base44.functions.invoke('moveInventory', {
        priceListItemId: item.id,
        fromLocationId,
        toLocationId,
        quantity: parseInt(quantity),
        movementType: 'transfer',
        notes,
        triggerNotification: true
      });

      if (response.data?.success) {
        toast.success(response.data.message);
        onSuccess?.();
        onClose();
        // Reset form
        setFromLocationId("");
        setToLocationId("");
        setQuantity(1);
        setNotes("");
      } else {
        toast.error(response.data?.error || 'Failed to move stock');
      }
    } catch (error) {
      console.error('Move stock error:', error);
      toast.error('Failed to move stock');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FAE008]" />
            Move Stock: {item?.item}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* From Location */}
            <div className="space-y-2">
              <Label>From Location *</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => {
                    const stock = getLocationStock(loc.id);
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
                  Available: {availableStock} units
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-[#9CA3AF]" />
            </div>

            {/* To Location */}
            <div className="space-y-2">
              <Label>To Location *</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter(loc => loc.id !== fromLocationId)
                    .map((loc) => {
                      const stock = getLocationStock(loc.id);
                      return (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({stock} currently)
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                max={availableStock}
                disabled={!fromLocationId}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this movement..."
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={isMoving || !fromLocationId || !toLocationId || loadingData}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            {isMoving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              'Move Stock'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}