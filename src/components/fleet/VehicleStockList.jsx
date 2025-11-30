import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, RefreshCw, Search, AlertTriangle, CheckCircle2, Truck, Box } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function VehicleStockList({ vehicleId, isTechnician }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState(1);
  const queryClient = useQueryClient();

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['vehicleStock', vehicleId],
    queryFn: () => base44.entities.VehicleStock.filter({ vehicle_id: vehicleId }),
    enabled: !!vehicleId
  });

  const { data: restockRequests = [] } = useQuery({
    queryKey: ['restockRequests', vehicleId],
    queryFn: () => base44.entities.RestockRequest.filter({ vehicle_id: vehicleId, status: 'Pending' }),
    enabled: !!vehicleId
  });

  const adjustStockMutation = useMutation({
    mutationFn: async ({ id, quantity, type }) => {
      // type: 'set' | 'increment' | 'decrement'
      const current = stock.find(s => s.id === id)?.quantity || 0;
      let newQuantity = current;
      if (type === 'set') newQuantity = quantity;
      if (type === 'increment') newQuantity = current + 1;
      if (type === 'decrement') newQuantity = Math.max(0, current - 1);

      return base44.entities.VehicleStock.update(id, { 
        quantity: newQuantity,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleStock', vehicleId] });
      toast.success("Stock updated");
    }
  });

  const requestRestockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStock) return;
      const user = await base44.auth.me();
      
      await base44.entities.RestockRequest.create({
        vehicle_id: vehicleId,
        vehicle_name: "My Vehicle", // Should fetch if not available, but simplified
        technician_id: user.id,
        technician_name: user.full_name,
        part_id: selectedStock.part_id,
        part_name: selectedStock.product_name,
        current_quantity: selectedStock.quantity,
        requested_quantity: parseInt(restockQuantity),
        status: "Pending"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restockRequests', vehicleId] });
      setShowRestockModal(false);
      setRestockQuantity(1);
      toast.success("Restock request sent");
    }
  });

  const filteredStock = stock.filter(item => 
    item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestockClick = (item) => {
    setSelectedStock(item);
    setRestockQuantity(Math.max(1, (item.ideal_quantity || 5) - item.quantity));
    setShowRestockModal(true);
  };

  if (isLoading) return <div className="py-8 text-center text-slate-500">Loading stock...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search stock..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Active Restock Requests Alert */}
      {restockRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-amber-600" />
          <div>
            <div className="text-sm font-medium text-amber-900">{restockRequests.length} Pending Restock Requests</div>
            <div className="text-xs text-amber-700">Waiting for admin approval</div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {filteredStock
         .sort((a, b) => {
             // Sort low stock to top for technicians, or always
             const aLow = a.quantity < (a.ideal_quantity || 0);
             const bLow = b.quantity < (b.ideal_quantity || 0);
             if (aLow && !bLow) return -1;
             if (!aLow && bLow) return 1;
             return 0;
         })
         .map(item => {
          const isLow = item.quantity < (item.ideal_quantity || 0);
          const pendingRequest = restockRequests.find(r => r.part_id === item.part_id);

          return (
            <Card key={item.id} className={`border shadow-sm ${isLow ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900 truncate">{item.product_name}</h4>
                    {isLow && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Low</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex gap-3">
                    <span>SKU: {item.sku || '-'}</span>
                    <span>Loc: {item.location_in_vehicle || 'N/A'}</span>
                    <span className={isLow ? "text-red-600 font-medium" : ""}>Ideal: {item.ideal_quantity || 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 h-9 overflow-hidden">
                    {isTechnician ? (
                        <div className="px-4 font-semibold text-slate-900 text-sm bg-slate-50 h-full flex items-center">
                            {item.quantity}
                        </div>
                    ) : (
                        <>
                            <button 
                            onClick={() => adjustStockMutation.mutate({ id: item.id, type: 'decrement' })}
                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 border-r border-slate-200"
                            >
                            <Minus className="w-3 h-3" />
                            </button>
                            <div className="w-10 text-center font-semibold text-slate-900 text-sm flex items-center justify-center">
                            {item.quantity}
                            </div>
                            <button 
                            onClick={() => adjustStockMutation.mutate({ id: item.id, type: 'increment' })}
                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 border-l border-slate-200"
                            >
                            <Plus className="w-3 h-3" />
                            </button>
                        </>
                    )}
                  </div>

                  {isTechnician && (
                      <Button
                        size="sm"
                        variant={pendingRequest ? "outline" : "secondary"}
                        disabled={!!pendingRequest}
                        onClick={() => handleRestockClick(item)}
                        className={pendingRequest ? "border-amber-200 text-amber-700 bg-amber-50" : ""}
                      >
                        {pendingRequest ? (
                          <Truck className="w-4 h-4" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredStock.length === 0 && (
          <div className="text-center py-8 text-slate-500">No items found</div>
        )}
      </div>

      <Dialog open={showRestockModal} onOpenChange={setShowRestockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Restock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <div className="font-medium text-lg">{selectedStock?.product_name}</div>
              <div className="text-sm text-slate-500">Current Qty: {selectedStock?.quantity}</div>
            </div>
            <div className="space-y-2">
              <Label>Quantity Needed</Label>
              <Input 
                type="number" 
                value={restockQuantity} 
                onChange={(e) => setRestockQuantity(e.target.value)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockModal(false)}>Cancel</Button>
            <Button onClick={() => requestRestockMutation.mutate()} disabled={requestRestockMutation.isPending}>
              {requestRestockMutation.isPending ? "Requesting..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}