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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PackageMinus, Loader2, CheckCircle } from "lucide-react";

export default function ManageJobStockModal({ job, projectParts = [], open, onClose }) {
  const [tab, setTab] = useState("preview");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [isDeducting, setIsDeducting] = useState(false);

  const queryClient = useQueryClient();

  // Fetch Price List Items
  const { data: priceItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
    enabled: open && tab === "add",
  });

  // Fetch available locations with inventory for selected item
  const { data: availableLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['inventory-for-item', selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return [];
      const quantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: selectedItemId
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
              quantity_id: qty.id
            });
          }
        }
      }
      return locationsWithStock;
    },
    enabled: open && tab === "add" && !!selectedItemId,
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
    return item.unit_cost ?? item.cost_price ?? item.buy_price ?? item.cost ?? item.price ?? 0;
  };

  const getLocationLabel = (part) => {
    // Priority: part.location > "Not allocated"
    if (part.location && part.location !== "unknown") {
      return part.location;
    }
    return "Not allocated";
  };

  // Add items used mutation (same as existing Items Used modal)
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

  const addItemsMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      if (!selectedItemId || !qty || qty <= 0 || !selectedLocationId) return;

      await base44.functions.invoke('recordStockMovement', {
        priceListItemId: selectedItemId,
        fromLocationId: selectedLocationId,
        toLocationId: null,
        quantity: qty,
        movementType: 'job_usage',
        reference_type: 'job',
        reference_id: job.id,
        jobId: job.id,
        projectId: job.project_id,
        notes: `Used on ${job.job_number} - ${job.customer_name || 'Job'}`
      });

      await addUsageCostToProject({
        projectId: job.project_id,
        price_list_item_id: selectedItemId,
        quantity: qty,
      });
    },
    onSuccess: () => {
      toast.success("Item usage recorded");
      setSelectedItemId("");
      setQuantity("1");
      setSelectedLocationId("");
      queryClient.invalidateQueries({ queryKey: ['vehicleStock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-quantities'] });
    },
    onError: (error) => {
      console.error("Error recording usage:", error);
      toast.error("Failed to record usage");
    }
  });

  // Deduct stock mutation (same as existing Deduct Stock button)
  const deductStockMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('processJobUsage', {
        job_id: job.id,
        mode: 'deduct'
      });
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.error || 'Failed to deduct stock');
    },
    onSuccess: (data) => {
      toast.success(`Deducted ${data.deducted_count} item(s) from stock`);
      if (data.skipped_count > 0) {
        toast.info(`${data.skipped_count} item(s) skipped`);
      }
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => onClose(), 500);
    },
    onError: (error) => {
      console.error("Error deducting stock:", error);
      toast.error(error.message || "Failed to deduct stock");
    }
  });

  const handleAddItems = (e) => {
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
    const selectedLocation = availableLocations.find(loc => loc.id === selectedLocationId);
    if (selectedLocation && Number(quantity) > selectedLocation.available_quantity) {
      toast.error(`Only ${selectedLocation.available_quantity} available at this location`);
      return;
    }
    addItemsMutation.mutate();
  };

  const handleDeductStock = () => {
    if (window.confirm("This will deduct recorded usage for this job from vehicle stock where applicable. Continue?")) {
      deductStockMutation.mutate();
    }
  };

  const handleClose = () => {
    setTab("preview");
    setSelectedItemId("");
    setQuantity("1");
    setSelectedLocationId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-[#FAE008]" />
            Manage Job Stock
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">Job Parts</TabsTrigger>
            <TabsTrigger value="add">Add Items Used</TabsTrigger>
            <TabsTrigger value="deduct">Deduct Stock</TabsTrigger>
          </TabsList>

          {/* Tab 1: Preview Job Parts */}
          <TabsContent value="preview" className="space-y-3 mt-4">
            <p className="text-sm text-[#6B7280] mb-4">
              Parts already associated with this job
            </p>
            {projectParts.length === 0 ? (
              <div className="text-center py-8 text-[#9CA3AF]">
                <p>No parts found for this job</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectParts.map((part) => (
                  <Card key={part.id} className="border border-[#E5E7EB]">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-[#111827] text-sm">
                            {part.item_name || part.category}
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">
                            Qty: {part.quantity_required || 1}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {getLocationLabel(part)}
                          </Badge>
                          <div className="text-xs text-[#6B7280] mt-1">
                            {part.status || 'pending'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Add Items Used */}
          <TabsContent value="add" className="space-y-4 mt-4">
            <form onSubmit={handleAddItems} className="space-y-4">
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
                        {selectedItemId ? "No stock available" : "Select an item first"}
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

              <Button 
                type="submit" 
                className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                disabled={addItemsMutation.isPending}
              >
                {addItemsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Record Item Usage"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Tab 3: Deduct Stock */}
          <TabsContent value="deduct" className="space-y-4 mt-4">
            {job.stock_usage_status === 'completed' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Stock Already Deducted</span>
                </div>
                <p className="text-sm text-green-700">
                  Inventory for items used has been deducted from technician's vehicle stock.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    This will deduct recorded usage for this job from the assigned technician's vehicle stock where applicable.
                  </p>
                </div>
                <Button 
                  onClick={handleDeductStock}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11"
                  disabled={deductStockMutation.isPending}
                >
                  {deductStockMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Deduct Stock Now"
                  )}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}