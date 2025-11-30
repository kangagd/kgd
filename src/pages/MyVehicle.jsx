import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Truck, Box, User } from "lucide-react";
import VehicleStockList from "../components/fleet/VehicleStockList";

export default function MyVehicle() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: myVehicle, isLoading } = useQuery({
    queryKey: ['myVehicle', user?.id],
    queryFn: async () => {
      // We need to filter vehicles assigned to this user. 
      // Assuming assigned_to stores user ID or we can match somehow. 
      // The schema says `assigned_to` is user_id.
      const vehicles = await base44.entities.Vehicle.filter({ assigned_to: user.id });
      return vehicles[0] || null;
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return <div className="p-10 text-center">Loading vehicle data...</div>;
  }

  if (!myVehicle) {
    return (
      <div className="p-4 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-3xl mx-auto text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No Vehicle Assigned</h2>
          <p className="text-slate-500">You currently don't have a vehicle assigned to your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen pb-24">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">My Vehicle</h1>
            <div className="flex items-center gap-2 text-slate-600 mt-1">
              <span className="font-medium">{myVehicle.name}</span>
              <span>•</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{myVehicle.registration}</span>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-medium text-green-600">{myVehicle.status}</div>
          </div>
        </div>

        <Card className="border-2 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Box className="w-5 h-5 text-slate-500" />
              Vehicle Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <VehicleStockList vehicleId={myVehicle.id} isTechnician={true} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}