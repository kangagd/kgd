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
  User
} from "lucide-react";
import VehicleDetail from "../components/fleet/VehicleDetail";
import { format } from "date-fns";

export default function Fleet() {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
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
    return <VehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicle(null)} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-500 mt-1">Manage vehicles, assignments, and inventory</p>
        </div>
        <Button className="bg-[#FAE008] hover:bg-[#E5CF07] text-black font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

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
            onClick={() => setSelectedVehicle(vehicle)}
          >
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-[#FAE008]/20 transition-colors">
                    <Car className="w-5 h-5 text-gray-600 group-hover:text-black" />
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