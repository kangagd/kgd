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
  Wrench,
  TestTube2
} from "lucide-react";
import LocationBadge from "@/components/common/LocationBadge";
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
import { WAREHOUSE_LOCATION, STOCK_MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";

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

  const updatePartsHardwareMutation = useMutation({
    mutationFn: async ({ id, quantity_present, condition }) => {
      const payload = {
        quantity_present,
        condition,
        last_checked_at: new Date().toISOString(),
      };
      return base44.entities.VehiclePartsHardwareAssignment.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicle-parts-hardware", vehicle?.id]);
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
      console.log('MyVehicle - User ID:', user.id);
      console.log('MyVehicle - User object:', user);
      const vehicles = await base44.entities.Vehicle.filter({ assigned_user_id: user.id });
      console.log('MyVehicle - Vehicles found:', vehicles);
      return vehicles[0] || null;
    },
    enabled: !!user
  });

  const { data: stock = [], isLoading: isStockLoading } = useQuery({
    queryKey: ['vehicleStock', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      const inventoryLoc = await base44.entities.InventoryLocation.filter({ 
        type: 'vehicle',
        vehicle_id: vehicle.id 
      });
      if (inventoryLoc.length === 0) return [];
      
      const quantities = await base44.entities.InventoryQuantity.filter({
        location_id: inventoryLoc[0].id
      });
      
      // Get PriceListItems to fetch car_quantity
      const priceListItems = await base44.entities.PriceListItem.list('item');
      const itemMap = priceListItems.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
      
      // Transform InventoryQuantity to VehicleStock shape for compatibility
      return quantities.map(q => {
        const item = itemMap[q.price_list_item_id];
        return {
          id: q.id,
          product_id: q.price_list_item_id,
          product_name: q.item_name,
          quantity_on_hand: q.quantity,
          minimum_target_quantity: item?.car_quantity || 0,
          category: item?.category || 'Stock',
          location_label: inventoryLoc[0].name
        };
      });
    },
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
      // Get vehicle location first
      const vehicleLocations = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicle.id
      });
      if (vehicleLocations.length === 0) return [];
      // Then get quantities for that location
      const all = await base44.entities.InventoryQuantity.filter({
        location_id: vehicleLocations[0].id,
      });
      return all;
    },
    enabled: !!vehicle?.id,
  });

  const inventoryByItem = useMemo(() => {
    const map = {};
    for (const iq of vehicleInventory) {
      if (!iq.price_list_item_id) continue;
      map[iq.price_list_item_id] = (map[iq.price_list_item_id] || 0) + (iq.quantity || 0);
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
      // Get vehicle location first
      const vehicleLocations = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicle.id
      });
      if (vehicleLocations.length === 0) return [];
      // Filter for usage movements from this vehicle location
      const all = await base44.entities.StockMovement.filter({
        from_location_id: vehicleLocations[0].id,
        movement_type: 'job_usage',
      });
      
      // Client-side date filter for "today"
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

  const { data: vehiclePartsHardware = [], isLoading: partsHardwareLoading } = useQuery({
    queryKey: ["vehicle-parts-hardware", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      return base44.entities.VehiclePartsHardwareAssignment.filter({
        vehicle_id: vehicle.id,
      });
    },
    enabled: !!vehicle?.id,
  });

  const { data: toolItems = [] } = useQuery({
    queryKey: ["tool-items"],
    queryFn: () => base44.entities.ToolItem.list("name"),
  });

  const { data: partsHardwareItems = [] } = useQuery({
    queryKey: ["parts-hardware-items"],
    queryFn: () => base44.entities.PartsHardwareItem.list("name"),
  });

  const { data: samplesInVehicle = [], isLoading: samplesLoading } = useQuery({
    queryKey: ["samples-in-vehicle", vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      return base44.entities.Sample.filter({
        current_location_type: "vehicle",
        current_location_reference_id: vehicle.id,
      });
    },
    enabled: !!vehicle?.id,
  });

  const toolItemMap = useMemo(() => {
    const map = {};
    for (const t of toolItems) {
      if (t.is_active !== false) {
        map[t.id] = t;
      }
    }
    return map;
  }, [toolItems]);

  const partsHardwareItemMap = useMemo(() => {
    const map = {};
    for (const p of partsHardwareItems) {
      if (p.is_active !== false) {
        map[p.id] = p;
      }
    }
    return map;
  }, [partsHardwareItems]);

  // Filter out assignments that reference deleted/inactive items
  const activeVehicleTools = useMemo(() => {
    return vehicleTools.filter(vt => vt.tool_item_id && toolItemMap[vt.tool_item_id]);
  }, [vehicleTools, toolItemMap]);

  const activeVehiclePartsHardware = useMemo(() => {
    return vehiclePartsHardware.filter(vp => vp.parts_hardware_id && partsHardwareItemMap[vp.parts_hardware_id]);
  }, [vehiclePartsHardware, partsHardwareItemMap]);

  const groupedToolsByLocation = useMemo(() => {
    const groups = {};
    for (const vt of activeVehicleTools) {
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
  }, [activeVehicleTools, toolItemMap]);

  const latestCheck = useMemo(() => {
    if (!activeVehicleTools?.length) return null;
    const dates = activeVehicleTools
      .map((vt) => vt.last_checked_at && new Date(vt.last_checked_at))
      .filter(Boolean);
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }, [activeVehicleTools]);

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
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-slate-600" />
            Tools in this vehicle
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isAuditMode ? "outline" : "ghost"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setIsAuditMode((v) => !v)}
              disabled={vehicleToolsLoading}
            >
              {isAuditMode ? "Exit audit mode" : "Audit tools"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => syncToolsMutation.mutate()}
              disabled={syncToolsMutation.isLoading || !vehicle}
            >
              {syncToolsMutation.isLoading ? "Syncing..." : "Sync tools"}
            </Button>
          </div>
        </div>
        {latestCheck && (
          <p className="mb-3 text-[11px] text-gray-500">
            Last tools check: {latestCheck.toLocaleString()}
          </p>
        )}

        {vehicleToolsLoading ? (
          <p className="text-sm text-gray-500">Loading tools...</p>
        ) : !activeVehicleTools.length ? (
          <p className="text-sm text-gray-500 italic">
            No tools have been configured for this vehicle yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedToolsByLocation).map(([location, items]) => (
              <div key={location} className="border rounded-xl bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <LocationBadge location={location} />
                  </div>
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
                          {isAuditMode ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                className="w-14 rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                                value={onHand}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value, 10);
                                  const safeValue = Number.isNaN(value) ? 0 : Math.max(0, value);
                                  updateVehicleToolMutation.mutate({
                                    id: vehicleTool.id,
                                    quantity_on_hand: safeValue,
                                  });
                                }}
                              />
                              <span className="text-[11px] text-gray-500">
                                / {required}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-600 font-mono">
                              {onHand} / {required}
                            </span>
                          )}

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

      {/* Samples Section */}
      <div className="mb-4 bg-blue-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Samples in Vehicle
          </h3>
        </div>

        {samplesLoading ? (
          <p className="text-sm text-gray-500">Loading samples...</p>
        ) : !samplesInVehicle.length ? (
          <p className="text-sm text-gray-500 italic">
            No samples currently in this vehicle.
          </p>
        ) : (
          <div className="space-y-2">
            {samplesInVehicle.map((sample) => (
              <div key={sample.id} className="p-3 border border-blue-200 rounded-lg bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {sample.name}
                    </div>
                    {sample.category && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {sample.category}
                      </div>
                    )}
                    {sample.sample_tag && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Tag: {sample.sample_tag}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {sample.status || 'active'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parts & Hardware Section */}
      <div className="mb-4 bg-emerald-50 rounded-xl border border-emerald-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Parts & Hardware
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">Overhead items (not tracked as stock)</p>

        {partsHardwareLoading ? (
          <p className="text-sm text-gray-500">Loading items...</p>
        ) : !activeVehiclePartsHardware.length ? (
          <p className="text-sm text-gray-500 italic">
            No items assigned to this vehicle yet.
          </p>
        ) : (
          <div className="space-y-2">
            {activeVehiclePartsHardware.map((vc) => {
              const conditionColors = {
                Full: "bg-emerald-50 text-emerald-700 border-emerald-200",
                Low: "bg-amber-50 text-amber-700 border-amber-200",
                Empty: "bg-red-50 text-red-700 border-red-200",
              };
              return (
                <div key={vc.id} className="p-3 border border-emerald-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">
                      {vc.item_name}
                    </div>
                    <Badge variant="outline" className={`text-xs ${conditionColors[vc.condition]}`}>
                      {vc.condition}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Qty:</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-20 h-8 text-xs"
                      value={vc.quantity_present || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updatePartsHardwareMutation.mutate({
                          id: vc.id,
                          quantity_present: value,
                          condition: vc.condition,
                        });
                      }}
                      />
                      <label className="text-xs text-gray-500 ml-2">Condition:</label>
                      <select
                      className="h-8 rounded border border-gray-300 px-2 text-xs"
                      value={vc.condition}
                      onChange={(e) => {
                        updatePartsHardwareMutation.mutate({
                          id: vc.id,
                          quantity_present: vc.quantity_present,
                          condition: e.target.value,
                        });
                      }}
                      >
                      <option value="Full">Full</option>
                      <option value="Low">Low</option>
                      <option value="Empty">Empty</option>
                    </select>
                  </div>
                </div>
              );
            })}
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