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
import { PackageMinus, Loader2, Trash2, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function JobItemsUsedModal({ job, vehicle, open, onClose, onSaved }) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [activeTab, setActiveTab] = useState("add");
  const queryClient = useQueryClient();

  // Fetch Price List Items
  const { data: priceItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
    enabled: open,
  });

  // Fetch existing stock movements (items used) for this job
  const { data: stockMovements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['jobStockMovements', job.id],
    queryFn: () => base44.entities.StockMovement.filter({ 
      job_id: job.id,
      movement_type: MOVEMENT_TYPE.USAGE
    }),
    enabled: open && !!job.id,
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

  const adjustInventoryForUsage = async ({ price_list_item_id, quantity, vehicle }) => {
    if (!price_list_item_id || !quantity) return;
  
    const fromLocationType = vehicle ? LOCATION_TYPE.VEHICLE : LOCATION_TYPE.WAREHOUSE;
    const fromLocationId = vehicle ? vehicle.id : "warehouse_main";
  
    // Update InventoryQuantity
    const existingRows = await base44.entities.InventoryQuantity.filter({
      price_list_item_id,
      location_type: fromLocationType,
      location_id: fromLocationId,
    });
  
    if (existingRows && existingRows.length > 0) {
      const row = existingRows[0];
      const currentQty = row.quantity_on_hand || 0;
      const newQty = Math.max(0, currentQty - quantity);
  
      await base44.entities.InventoryQuantity.update(row.id, {
        quantity_on_hand: newQty,
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
    queryClient.invalidateQueries(["inventory-quantities-for-vehicle", vehicle?.id]);
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
      if (!selectedItemId || !qty || qty <= 0) return;

      const payload = {
        price_list_item_id: selectedItemId,
        quantity: qty,
        movement_type: MOVEMENT_TYPE.USAGE,
        from_location_type: vehicle ? LOCATION_TYPE.VEHICLE : LOCATION_TYPE.WAREHOUSE,
        from_location_id: vehicle ? vehicle.id : "warehouse_main",
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
        vehicle,
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
    createMovementMutation.mutate();
  };

  const handleClose = () => {
    setSelectedItemId("");
    setQuantity("1");
    setActiveTab("add");
    onClose();
  };

  const deleteMovementMutation = useMutation({
    mutationFn: async (movementId) => {
      await base44.entities.StockMovement.delete(movementId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobStockMovements', job.id] });
      queryClient.invalidateQueries({ queryKey: ['vehicleStock'] });
      queryClient.invalidateQueries({ queryKey: ['priceListItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
      toast.success("Item removed");
      if (onSaved) onSaved();
    },
    onError: (error) => {
      console.error("Error deleting movement:", error);
      toast.error("Failed to remove item");
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-[#FAE008]" />
            Items Used on Job
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </TabsTrigger>
            <TabsTrigger value="view">
              <PackageMinus className="w-4 h-4 mr-1" />
              View Items ({stockMovements.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
            />
          </div>

              <div className="pt-2 text-xs text-gray-500">
                Source: {vehicle ? `Vehicle: ${vehicle.name}` : "Warehouse (Default)"}
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
          </TabsContent>

          <TabsContent value="view" className="mt-4">
            <div className="space-y-4">
              {movementsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : stockMovements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No items recorded yet
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stockMovements.map((movement) => {
                    const item = priceListMap[movement.price_list_item_id];
                    return (
                      <div 
                        key={movement.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">
                            {item?.item || "Unknown Item"}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            Qty: {movement.quantity} • {item?.category || "N/A"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Remove this item from the job?')) {
                              deleteMovementMutation.mutate(movement.id);
                            }
                          }}
                          disabled={deleteMovementMutation.isPending}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}