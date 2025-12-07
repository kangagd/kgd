import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Car, 
  Search, 
  Plus, 
  AlertTriangle,
  Battery,
  User,
  Package,
  Wrench
} from "lucide-react";
import VehicleDetail from "../components/fleet/VehicleDetail";
import VehicleFormModal from "../components/fleet/VehicleFormModal";
import { format } from "date-fns";
import { useMemo } from "react";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";

export default function Fleet() {
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-name')
  });

  const selectedVehicle = useMemo(() => 
    vehicles.find(v => v.id === selectedVehicleId), 
    [vehicles, selectedVehicleId]
  );

  const { data: partsWithVehicles = [] } = useQuery({
    queryKey: ["parts-with-vehicles"],
    queryFn: async () => {
      const allParts = await base44.entities.Part.filter({
        location: "With Technician",
      });
      return allParts.filter((p) => p.assigned_vehicle_id);
    },
  });

  const partsCountByVehicle = useMemo(() => {
    return partsWithVehicles.reduce((acc, part) => {
      const vid = part.assigned_vehicle_id;
      if (!vid) return acc;
      acc[vid] = (acc[vid] || 0) + 1;
      return acc;
    }, {});
  }, [partsWithVehicles]);

  const { data: allVehicleTools = [] } = useQuery({
    queryKey: ["vehicle-tools-for-fleet"],
    queryFn: () => base44.entities.VehicleTool.list("id"),
  });

  const toolComplianceByVehicle = useMemo(() => {
    const map = {};
    for (const vt of allVehicleTools) {
      if (!vt.vehicle_id) continue;
      if (!map[vt.vehicle_id]) {
        map[vt.vehicle_id] = {
          required: 0,
          present: 0,
        };
      }
      const required = vt.quantity_required ?? 0;
      const onHand = vt.quantity_on_hand ?? 0;
      map[vt.vehicle_id].required += required;
      map[vt.vehicle_id].present += Math.min(onHand, required);
    }
    return map;
  }, [allVehicleTools]);

  const getToolCompliance = (vehicleId) => {
    const stats = toolComplianceByVehicle[vehicleId];
    if (!stats || stats.required === 0) return null;
    const pct = (stats.present / stats.required) * 100;
    return Math.round(pct);
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesStatus = filterStatus === "all" || v.status === filterStatus;
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || 
                          v.registration_plate?.toLowerCase().includes(search.toLowerCase()) ||
                          v.assigned_user_name?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (selectedVehicleId && selectedVehicle) {
    return <VehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicleId(null)} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton to={createPageUrl("Dashboard")} />
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-500 mt-1">Manage vehicles, assignments, and inventory</p>
        </div>
        <Button 
          className="bg-[#FAE008] hover:bg-[#E5CF07] text-black font-semibold"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <VehicleFormModal 
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search vehicles..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="In Maintenance">In Maintenance</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map(vehicle => (
          <Card 
            key={vehicle.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer group border-gray-200"
            onClick={() => setSelectedVehicleId(vehicle.id)}
          >
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden group-hover:bg-[#FAE008]/20 transition-colors">
                    {vehicle.photo_url ? (
                      <img src={vehicle.photo_url} alt={vehicle.name} className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-6 h-6 text-gray-600 group-hover:text-black" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{vehicle.name}</h3>
                    <div className="text-sm text-gray-500 font-mono">{vehicle.registration_plate}</div>
                  </div>
                </div>
                <Badge variant={vehicle.status === 'Active' ? 'success' : 'secondary'} className={vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : ''}>
                  {vehicle.status}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  {vehicle.assigned_user_name || "Unassigned"}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 rounded-full bg-gray-400 mr-3 ml-1" />
                  {vehicle.primary_location || "No location set"}
                </div>
                
                <div className="flex items-center text-sm">
                  {partsCountByVehicle[vehicle.id] > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ml-1">
                      <Package className="w-3 h-3 mr-1" />
                      {partsCountByVehicle[vehicle.id]} part{partsCountByVehicle[vehicle.id] !== 1 ? "s" : ""} assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-400 ml-1">
                      No parts assigned
                    </span>
                  )}
                </div>

                <div className="flex items-center text-sm ml-1">
                  {(() => {
                    const compliance = getToolCompliance(vehicle.id);
                    if (compliance === null) {
                      return (
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">
                          <Wrench className="w-3 h-3 mr-1" />
                          Tools: no data
                        </span>
                      );
                    } else if (compliance === 100) {
                      return (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <Wrench className="w-3 h-3 mr-1" />
                          Tools: 100% complete
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          <Wrench className="w-3 h-3 mr-1" />
                          Tools: {compliance}% complete
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm text-[#FAE008] font-semibold group-hover:underline">View Details</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}