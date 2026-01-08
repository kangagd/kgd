import React, { useState, useMemo } from "react";
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
import { LOCATION_TYPE, MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";
import { toast } from "sonner";
import { PackageMinus, Loader2 } from "lucide-react";

export default function JobItemsUsedModal({ job, vehicle, open, onClose, onSaved }) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const queryClient = useQueryClient();

  // Fetch Price List Items
  const { data: priceItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
    enabled: open,
  });

  // Fetch available locations with inventory for selected item
  const { data: availableLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['inventory-for-item', selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      
      // Get all inventory quantities for this item from all locations
      const quantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: selectedItemId
      });
      
      // Get all active locations (warehouses + vehicles)
      const allLocations = await base44.entities.InventoryLocation.list();
      const locationMap = new Map(allLocations.map(loc => [loc.id, loc]));
      
      // Build locations with stock
      const locationsWithStock = [];
      for (const qty of quantities) {
        if ((qty.quantity || 0) > 0) {
          const location = locationMap.get(qty.location_id);
          if (location && location.is_active !== false) {
            locationsWithStock.push({
              ...location,
              available_quantity: qty.quantity || 0,
              quantity_id: qty.id
            });
          }
        }
      }
      
      return locationsWithStock;
    },
    enabled: open && !!selectedItemId,
  });

  const priceListMap = useMemo(() => {
    const map = {};
    for (const item of priceItems) {
      map[item.id] = item;
    }
    return map;
  }, [priceItems]);

  const getUnitCost = (item) => {
    if (!item) return 0;
    return (
      item.unit_cost ??
      item.cost_price ??
      item.buy_price ??
      item.cost ??
      item.price ??
      0
    );
  };

  const adjustInventoryForUsage = async ({ price_list_item_id, quantity, location_id }) => {
    if (!price_list_item_id || !quantity || !location_id) return;
  
    // Update InventoryQuantity for the selected location
    const existingRows = await base44.entities.InventoryQuantity.filter({
      price_list_item_id,
      location_id: location_id,
    });
  
    if (existingRows && existingRows.length > 0) {
      const row = existingRows[0];
      const currentQty = row.quantity || 0;
      const newQty = Math.max(0, currentQty - quantity);
  
      await base44.entities.InventoryQuantity.update(row.id, {
        quantity: newQty,
      });
    }
  
    // Update PriceListItem global stock
    const item = priceListMap[price_list_item_id];
    if (item && typeof item.stock_level === "number") {
      const newStockLevel = Math.max(0, (item.stock_level || 0) - quantity);
      await base44.entities.PriceListItem.update(price_list_item_id, {
        stock_level: newStockLevel,
      });
    }
  
    queryClient.invalidateQueries(["inventory-quantities"]);
    queryClient.invalidateQueries(["inventory-for-item", price_list_item_id]);
    queryClient.invalidateQueries(["priceListItems"]);
  };

  const addUsageCostToProject = async ({ projectId, price_list_item_id, quantity }) => {
    if (!price_list_item_id || !quantity || !projectId) return;
  
    const targetProject = await base44.entities.Project.get(projectId);
    if (!targetProject) return;
  
    const priceItem = priceListMap[price_list_item_id] ||
      (await base44.entities.PriceListItem.get(price_list_item_id));
      
    const unitCost = getUnitCost(priceItem);
    const delta = unitCost * quantity;
  
    const currentMaterials = targetProject.materials_cost || 0;
    const newMaterials = currentMaterials + delta;
  
    await base44.entities.Project.update(targetProject.id, {
      materials_cost: newMaterials,
    });
  
    queryClient.invalidateQueries(["project", targetProject.id]);
    queryClient.invalidateQueries(["projects"]);
  };

  // Create Stock Movement and Adjust Inventory
  const createMovementMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      if (!selectedItemId || !qty || qty <= 0 || !selectedLocationId) return;

      const selectedLocation = availableLocations.find(loc => loc.id === selectedLocationId);
      
      const payload = {
        price_list_item_id: selectedItemId,
        quantity: qty,
        movement_type: MOVEMENT_TYPE.USAGE,
        from_location_type: selectedLocation?.type === 'vehicle' ? LOCATION_TYPE.VEHICLE : LOCATION_TYPE.WAREHOUSE,
        from_location_id: selectedLocationId,
        to_location_type: LOCATION_TYPE.OTHER,
        to_location_id: `job:${job.id}`,
        job_id: job.id,
        project_id: job.project_id,
        technician_id: job.assigned_to && job.assigned_to.length > 0 ? job.assigned_to[0] : null,
        created_at: new Date().toISOString(),
      };
      
      // 1) Create StockMovement
      await base44.entities.StockMovement.create(payload);

      // 2) Adjust inventory at source
      await adjustInventoryForUsage({
        price_list_item_id: selectedItemId,
        quantity: qty,
        location_id: selectedLocationId,
      });

      // 3) Add cost to Project.materials_cost
      await addUsageCostToProject({
        projectId: job.project_id,
        price_list_item_id: selectedItemId,
        quantity: qty,
      });
    },
    onSuccess: () => {
      toast.success("Item usage recorded");
      queryClient.invalidateQueries({ queryKey: ['vehicleStock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-usage-today'] });
      if (onSaved) onSaved();
      handleClose();
    },
    onError: (error) => {
      console.error("Error recording usage:", error);
      toast.error("Failed to record usage");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error("Please select an item");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (!selectedLocationId) {
      toast.error("Please select a location");
      return;
    }
    
    // Check if selected quantity exceeds available
    const selectedLocation = availableLocations.find(loc => loc.id === selectedLocationId);
    if (selectedLocation && Number(quantity) > selectedLocation.available_quantity) {
      toast.error(`Only ${selectedLocation.available_quantity} available at this location`);
      return;
    }
    
    createMovementMutation.mutate();
  };

  const handleClose = () => {
    setSelectedItemId("");
    setQuantity("1");
    setSelectedLocationId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-[#FAE008]" />
            Record Item Usage
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Item Used</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item..." />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {itemsLoading ? (
                  <div className="p-2 text-center text-sm text-gray-500">Loading items...</div>
                ) : (
                  priceItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item} ({item.category})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Select 
              value={selectedLocationId} 
              onValueChange={setSelectedLocationId}
              disabled={!selectedItemId || locationsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !selectedItemId 
                    ? "Select an item first..." 
                    : locationsLoading 
                      ? "Loading locations..." 
                      : "Select location..."
                } />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.length === 0 ? (
                  <div className="p-2 text-center text-sm text-gray-500">
                    {selectedItemId ? "No stock available at any location" : "Select an item first"}
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
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              disabled={!selectedLocationId}
            />
            {selectedLocationId && availableLocations.find(loc => loc.id === selectedLocationId) && (
              <p className="text-xs text-gray-500">
                Available: {availableLocations.find(loc => loc.id === selectedLocationId).available_quantity}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
              disabled={createMovementMutation.isPending}
            >
              {createMovementMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm Usage"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}