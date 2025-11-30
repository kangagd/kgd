import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, User, Box, Truck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import VehicleStockList from "./VehicleStockList";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export default function VehicleDetail({ vehicle, onClose, onEdit }) {
  const [activeTab, setActiveTab] = useState("stock");
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['vehicleRestockRequests', vehicle.id],
    queryFn: () => base44.entities.RestockRequest.filter({ vehicle_id: vehicle.id }, '-created_at')
  });

  const handleRequestAction = useMutation({
    mutationFn: async ({ id, status, logistics }) => {
      // If logistics is true, we might create a job (simplified here just status update)
      // In a real app, we'd call a backend function to create the logistics job
      // Here we assume basic status update for UI demo
      await base44.entities.RestockRequest.update(id, { status });
      
      if (status === 'Approved' && logistics) {
        // Call backend to create job
        await base44.functions.invoke('createRestockLogisticsJob', { requestId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleRestockRequests', vehicle.id] });
      toast.success("Request updated");
    }
  });

  return (
    <div className="bg-white min-h-screen p-4 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <Badge variant="outline" className="font-mono">{vehicle.registration}</Badge>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {vehicle.assigned_to ? 'Assigned' : 'Unassigned'}
              </span>
              <Badge className={
                vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 
                vehicle.status === 'Maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
              }>
                {vehicle.status}
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="stock" className="gap-2">
              <Box className="w-4 h-4" />
              Stock Inventory
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <Truck className="w-4 h-4" />
              Restock Requests
              {requests.filter(r => r.status === 'Pending').length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-amber-500">{requests.filter(r => r.status === 'Pending').length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
            <Card className="border-2 border-slate-200">
              <CardContent className="p-6">
                <VehicleStockList vehicleId={vehicle.id} isTechnician={false} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Restock Requests</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {requests.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No requests found</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {requests.map(req => (
                      <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${req.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Box className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{req.part_name}</div>
                            <div className="text-sm text-slate-600">
                              Qty: {req.requested_quantity} • By {req.technician_name}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {format(parseISO(req.created_date || new Date().toISOString()), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {req.status === 'Pending' ? (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleRequestAction.mutate({ id: req.id, status: 'Approved', logistics: true })}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Approve & Send
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRequestAction.mutate({ id: req.id, status: 'Rejected' })}
                                className="text-red-600 hover:bg-red-50"
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Badge variant="outline" className={
                              req.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                              req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-50 text-slate-600'
                            }>
                              {req.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}