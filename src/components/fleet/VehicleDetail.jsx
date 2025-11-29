import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, RefreshCw, Plus, Settings, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import VehicleStockList from "./VehicleStockList";
import { format } from "date-fns";
import StockAdjustmentModal from "./StockAdjustmentModal";

export default function VehicleDetail({ vehicle, onBack }) {
  const [activeTab, setActiveTab] = useState("stock");
  const [adjustmentItem, setAdjustmentItem] = useState(null);

  const { data: stock = [], isLoading: isStockLoading } = useQuery({
    queryKey: ['vehicleStock', vehicle.id],
    queryFn: () => base44.entities.VehicleStock.filter({ vehicle_id: vehicle.id })
  });

  const { data: movements = [], isLoading: isMovementsLoading } = useQuery({
    queryKey: ['vehicleMovements', vehicle.id],
    queryFn: () => base44.entities.VehicleStockMovement.filter({ vehicle_id: vehicle.id }, '-created_date', 50)
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 pl-0 hover:bg-transparent hover:text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Fleet
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{vehicle.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-gray-600">
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{vehicle.registration_plate}</span>
            <span>•</span>
            <span>{vehicle.status}</span>
            <span>•</span>
            <span>{vehicle.assigned_user_name || "Unassigned"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Edit Vehicle
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 h-auto">
          <TabsTrigger value="stock" className="px-6 py-2">Stock Inventory</TabsTrigger>
          <TabsTrigger value="movements" className="px-6 py-2">History & Movements</TabsTrigger>
          <TabsTrigger value="overview" className="px-6 py-2">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current Inventory</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Restock List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <VehicleStockList 
                stock={stock} 
                isLoading={isStockLoading}
                onMarkUsed={() => {}} // Admin probably doesn't mark used often, or maybe they do
                onAdjust={(item) => setAdjustmentItem(item)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Stock History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Change</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {movements.map((move) => (
                      <tr key={move.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-600">
                          {format(new Date(move.created_date), 'MMM d, HH:mm')}
                        </td>
                        <td className="p-3 font-medium text-gray-900">
                          {/* We might need to join product name if not denormalized, but schema says it is linked via ID */}
                          {/* Schema for movement doesn't have denormalized name, so we might need to fetch it or assume it's linked to price list item */}
                          {/* Actually schema has product_id reference. For display we might need to fetch product details or join. */}
                          {/* For now, display ID or handle gracefully. Wait, VehicleStock has name. */}
                          {stock.find(s => s.product_id === move.product_id)?.product_name || "Item"}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            move.movement_type === 'ConsumeOnJob' ? 'bg-red-100 text-red-800' :
                            move.movement_type === 'RestockFromWarehouse' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {move.movement_type.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-mono font-medium ${move.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {move.quantity_change > 0 ? '+' : ''}{move.quantity_change}
                        </td>
                        <td className="p-3 text-gray-600">{move.performed_by_user_name}</td>
                        <td className="p-3 text-gray-500 text-xs truncate max-w-[150px]">
                          {move.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movements.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No history found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="font-medium">{vehicle.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Internal Code</div>
                  <div className="font-medium">{vehicle.internal_code || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Primary Location</div>
                  <div className="font-medium">{vehicle.primary_location || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Notes</div>
                  <div className="text-sm mt-1 bg-gray-50 p-3 rounded-lg">{vehicle.notes || "No notes"}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <StockAdjustmentModal
        open={!!adjustmentItem}
        onClose={() => setAdjustmentItem(null)}
        item={adjustmentItem}
        vehicleId={vehicle.id}
      />
    </div>
  );
}