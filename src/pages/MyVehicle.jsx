import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Truck, 
  Search, 
  Filter, 
  AlertTriangle, 
  History, 
  Plus, 
  MoreVertical, 
  Package, 
  ArrowDownLeft,
  RefreshCw,
  ClipboardList,
  Loader2,
  Wrench
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import RestockRequestModal from "../components/fleet/RestockRequestModal";
import StockAdjustmentModal from "../components/fleet/StockAdjustmentModal";
import StockUsageModal from "../components/fleet/StockUsageModal";
import VehicleStockList from "../components/fleet/VehicleStockList";
import { LOCATION_TYPE, MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";

export default function MyVehicle() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, low
  
  // Modals state
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState(null);
  const [usageItem, setUsageItem] = useState(null);

  const queryClient = useQueryClient();

  const updateVehicleToolMutation = useMutation({
    mutationFn: async ({ id, quantity_on_hand }) => {
      const payload = {
        quantity_on_hand,
        last_checked_at: new Date().toISOString(),
      };
      return base44.entities.VehicleTool.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-tools", vehicle?.id]);
    },
  });

  const syncToolsMutation = useMutation({
    mutationFn: async () => {
      if (!vehicle?.id) return;
      const existingToolIds = new Set(vehicleTools.map(vt => vt.tool_item_id));
      const missingTools = toolItems.filter(t => !existingToolIds.has(t.id));
      
      if (missingTools.length === 0) return;
      
      const promises = missingTools.map(tool => base44.entities.VehicleTool.create({
        vehicle_id: vehicle.id,
        tool_item_id: tool.id,
        quantity_required: tool.default_quantity_required || 1,
        quantity_on_hand: 0
      }));
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-tools", vehicle?.id]);
      toast.success("Tools synced");
    },
  });

  const [isAuditMode, setIsAuditMode] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: vehicle, isLoading: isVehicleLoading } = useQuery({
    queryKey: ['myVehicle', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const vehicles = await base44.entities.Vehicle.filter({ assigned_user_id: user.id });
      return vehicles[0] || null;
    },
    enabled: !!user
  });

  const { data: stock = [], isLoading: isStockLoading } = useQuery({
    queryKey: ['vehicleStock', vehicle?.id],
    queryFn: () => base44.entities.VehicleStock.filter({ vehicle_id: vehicle.id }),
    enabled: !!vehicle
  });

  const { data: assignedParts = [] } = useQuery({
    queryKey: ['parts-assigned-to-vehicle', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      const allParts = await base44.entities.Part.filter({
        assigned_vehicle_id: vehicle.id,
      });
      return allParts;
    },
    enabled: !!vehicle?.id,
  });

  const { data: vehicleInventory = [] } = useQuery({
    queryKey: ["inventory-quantities-for-vehicle", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      const all = await base44.entities.InventoryQuantity.filter({
        location_type: LOCATION_TYPE.VEHICLE,
        location_id: vehicle.id,
      });
      return all;
    },
    enabled: !!vehicle?.id,
  });

  const inventoryByItem = useMemo(() => {
    const map = {};
    for (const iq of vehicleInventory) {
      if (!iq.price_list_item_id) continue;
      map[iq.price_list_item_id] = (map[iq.price_list_item_id] || 0) + (iq.quantity_on_hand || 0);
    }
    return map;
  }, [vehicleInventory]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-assigned-parts"],
    queryFn: () => base44.entities.Project.list("title"),
  });

  const { data: todaysUsage = [] } = useQuery({
    queryKey: ["stock-usage-today", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      // Filter for usage movements from this vehicle
      const all = await base44.entities.StockMovement.filter({
        from_location_type: LOCATION_TYPE.VEHICLE,
        from_location_id: vehicle.id,
        movement_type: MOVEMENT_TYPE.USAGE,
      });
      
      // Client-side date filter for "today" since we don't have date filters in the API yet for some backends
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return all.filter(m => new Date(m.created_at) >= today);
    },
    enabled: !!vehicle?.id,
  });

  const { data: priceItems = [] } = useQuery({
    queryKey: ['priceListItems-for-usage'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
  });

  const itemMap = useMemo(() => {
    return priceItems.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [priceItems]);

  const projectMap = useMemo(() => {
    return projects.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }, [projects]);

  const { data: vehicleTools = [], isLoading: vehicleToolsLoading } = useQuery({
    queryKey: ["vehicle-tools", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      return base44.entities.VehicleTool.filter({
        vehicle_id: vehicle.id,
      });
    },
    enabled: !!vehicle?.id,
  });

  const { data: toolItems = [] } = useQuery({
    queryKey: ["tool-items"],
    queryFn: () => base44.entities.ToolItem.filter({ is_active: true }),
  });

  const toolItemMap = useMemo(() => {
    const map = {};
    for (const t of toolItems) {
      map[t.id] = t;
    }
    return map;
  }, [toolItems]);

  const groupedToolsByLocation = useMemo(() => {
    const groups = {};
    for (const vt of vehicleTools) {
      const tool = vt.tool_item_id ? toolItemMap[vt.tool_item_id] : null;
      const location = vt.location || tool?.category || "Other";
      if (!groups[location]) {
        groups[location] = [];
      }
      groups[location].push({
        vehicleTool: vt,
        toolItem: tool,
      });
    }
    return groups;
  }, [vehicleTools, toolItemMap]);

  if (isVehicleLoading || !user) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>;
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-6 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Truck className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Vehicle Assigned</h2>
        <p className="text-gray-500 max-w-md">
          You don't currently have a vehicle assigned to your profile. Please contact an administrator to assign one.
        </p>
      </div>
    );
  }

  const filteredStock = stock.filter(item => {
    const matchesSearch = item.product_name?.toLowerCase().includes(search.toLowerCase()) || 
                          item.sku?.toLowerCase().includes(search.toLowerCase());
    
    if (filter === "low") {
      return matchesSearch && (item.quantity_on_hand < (item.minimum_target_quantity || 0));
    }
    
    return matchesSearch;
  });

  const lowStockCount = stock.filter(i => i.quantity_on_hand < (i.minimum_target_quantity || 0)).length;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-6 h-6 text-[#FAE008]" />
          {vehicle.name}
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{vehicle.registration_plate}</span>
          <span>•</span>
          <Badge variant={vehicle.status === 'Active' ? 'success' : 'secondary'} className={vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : ''}>
            {vehicle.status}
          </Badge>
          {vehicle.primary_location && (
            <>
              <span>•</span>
              <span>{vehicle.primary_location}</span>
            </>
          )}
        </div>
      </div>

      {/* Vehicle Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">Quick Stats</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Total Items</div>
            <div className="text-2xl font-bold text-gray-900">{stock.length}</div>
          </div>
          <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className={`text-sm mb-1 ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>Low Stock</div>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {lowStockCount}
            </div>
          </div>
        </div>

        {/* Today's Usage Summary */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items Used Today</h4>
          {todaysUsage.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No usage logged yet today.</p>
          ) : (
            <div className="space-y-1.5">
              {todaysUsage.map((usage) => {
                const item = itemMap[usage.price_list_item_id];
                return (
                  <div key={usage.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{item ? item.item : "Unknown Item"}</span>
                    <Badge variant="secondary" className="text-xs">
                      {usage.quantity} used
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stock List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Inventory</h3>
          <div className="flex gap-2">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === 'low' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}
                onClick={() => setFilter('low')}
              >
                Low Stock
              </button>
            </div>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search parts..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <VehicleStockList 
          stock={filteredStock} 
          onMarkUsed={(item) => setUsageItem(item)}
          onAdjust={(item) => setAdjustmentItem(item)}
          isLoading={isStockLoading}
          inventoryByItem={inventoryByItem}
        />
      </div>

      {/* Project Parts Assigned */}
      <div className="mb-4 bg-amber-50/50 rounded-xl border border-amber-100 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-600" />
          Project Parts Assigned to This Vehicle
        </h3>
        {assignedParts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No project parts are currently assigned to this vehicle.
          </p>
        ) : (
          <div className="space-y-2">
            {assignedParts.map((part) => {
              const project = part.project_id ? projectMap[part.project_id] : null;
              return (
                <div key={part.id} className="p-3 border border-amber-200 rounded-lg bg-white flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {part.category || "Part"}
                    </div>
                    {project ? (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Project: {project.title}
                      </div>
                    ) : part.project_id ? (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Project ID: {part.project_id}
                      </div>
                    ) : null}
                    {part.supplier_name && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {part.supplier_name}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-right">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mb-1">
                      {part.location}
                    </Badge>
                    <div className="text-gray-500">{part.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tools Section */}
      <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-slate-600" />
          Tools in this vehicle
        </h3>
        {vehicleToolsLoading ? (
          <p className="text-sm text-gray-500">Loading tools...</p>
        ) : !vehicleTools.length ? (
          <p className="text-sm text-gray-500 italic">
            No tools have been configured for this vehicle yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedToolsByLocation).map(([location, items]) => (
              <div key={location} className="border rounded-xl bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {location}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {items.length} tool{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(({ vehicleTool, toolItem }) => {
                    const required = vehicleTool.quantity_required ?? toolItem?.default_quantity_required ?? 0;
                    const onHand = vehicleTool.quantity_on_hand ?? 0;
                    const missingCount = Math.max(0, required - onHand);
                    const isMissing = required > 0 && onHand < required;

                    return (
                      <div
                        key={vehicleTool.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {toolItem?.name || "Unknown Tool"}
                          </div>
                          {toolItem?.notes && (
                            <div className="text-[10px] text-gray-500 truncate max-w-[200px]">
                              {toolItem.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-600 font-mono">
                            {onHand} / {required}
                          </span>
                          {isMissing ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                              Missing {missingCount}
                            </Badge>
                          ) : (
                            required > 0 && (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                                OK
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="w-full border-gray-300 text-gray-700"
            onClick={() => toast.info("View history coming soon")}
          >
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
          <Button 
            className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-black font-semibold"
            onClick={() => setShowRestockModal(true)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Request Restock
          </Button>
        </div>
      </div>

      {/* Modals */}
      <RestockRequestModal 
        open={showRestockModal} 
        onClose={() => setShowRestockModal(false)}
        vehicle={vehicle}
        stock={stock}
      />

      <StockAdjustmentModal
        open={!!adjustmentItem}
        onClose={() => setAdjustmentItem(null)}
        item={adjustmentItem}
        vehicleId={vehicle.id}
      />

      <StockUsageModal
        open={!!usageItem}
        onClose={() => setUsageItem(null)}
        item={usageItem}
        vehicleId={vehicle.id}
      />
    </div>
  );
}