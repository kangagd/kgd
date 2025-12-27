import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Truck, 
  Loader2,
  Wrench,
  Package
} from "lucide-react";
import LocationBadge from "@/components/common/LocationBadge";
import { toast } from "sonner";

export default function MyVehicle() {
  const [user, setUser] = useState(null);
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
      const vehicles = await base44.entities.Vehicle.filter({ assigned_user_id: user.id });
      return vehicles[0] || null;
    },
    enabled: !!user
  });

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

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
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
    </div>
  );
}