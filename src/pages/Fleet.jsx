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
  Truck,
  MapPin
} from "lucide-react";
import VehicleDetail from "../components/fleet/VehicleDetail";
import VehicleFormModal from "../components/fleet/VehicleFormModal";
import { format } from "date-fns";

export default function Fleet() {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-name')
  });

  const filteredVehicles = vehicles.filter(v => {
    const matchesStatus = filterStatus === "all" || v.status === filterStatus;
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || 
                          v.registration_plate?.toLowerCase().includes(search.toLowerCase()) ||
                          v.assigned_user_name?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (selectedVehicle) {
    return <VehicleDetail vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-[#ffffff] min-h-screen">
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
            <SelectItem value="In Service">In Service</SelectItem>
            <SelectItem value="Off Road">Off Road</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Vehicle Name / Code</th>
              <th className="px-6 py-4">Registration</th>
              <th className="px-6 py-4">Assigned Technician</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Stock Audit</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No vehicles found matching your filters.
                </td>
              </tr>
            ) : (
              filteredVehicles.map((vehicle) => (
                <tr 
                  key={vehicle.id} 
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Car className="w-4 h-4 text-gray-600" />
                      </div>
                      {vehicle.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600">
                    {vehicle.registration || vehicle.registration_plate}
                  </td>
                  <td className="px-6 py-4">
                    {vehicle.assigned_user_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                          {vehicle.assigned_user_name.charAt(0)}
                        </div>
                        <span className="text-gray-700">{vehicle.assigned_user_name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge 
                      className={`
                        ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                          vehicle.status === 'In Service' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 
                          'bg-red-100 text-red-800 hover:bg-red-100'}
                      `}
                    >
                      {vehicle.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {vehicle.last_stock_audit ? format(new Date(vehicle.last_stock_audit), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                     <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">View</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}