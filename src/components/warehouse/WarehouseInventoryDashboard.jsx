import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Warehouse, Truck, Plus, AlertTriangle, TrendingDown, ArrowRightLeft, History } from 'lucide-react';
import { toast } from 'sonner';
import StockTransferModal from './StockTransferModal';
import StockMovementHistory from './StockMovementHistory';

export default function WarehouseInventoryDashboard() {
  const queryClient = useQueryClient();
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showMovementHistory, setShowMovementHistory] = useState(false);

  // Fetch all locations (warehouses + vehicles)
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['inventoryLocations'],
    queryFn: () => base44.entities.InventoryLocation.filter({}, '-name'),
    staleTime: 60000
  });

  // Fetch all quantity records
  const { data: quantities = [], isLoading: quantitiesLoading } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
    staleTime: 60000
  });

  // Fetch price list items for metadata
  const { data: items = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.filter({ is_active: true }),
    staleTime: 120000
  });

  // Create warehouse mutation
  const createWarehouseMutation = useMutation({
    mutationFn: async (name) => {
      const response = await base44.functions.invoke('initializeWarehouseLocations', {
        action: 'create_warehouse',
        warehouse_name: name,
        warehouse_description: ''
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryLocations'] });
      setNewWarehouseName('');
      setShowCreateWarehouse(false);
      toast.success('Warehouse created');
    },
    onError: (error) => {
      toast.error(`Failed to create warehouse: ${error.message}`);
    }
  });

  const warehouses = locations.filter(l => l.type === 'warehouse');
  const vehicles = locations.filter(l => l.type === 'vehicle');

  const getLocationQuantities = (locationId) => {
    return quantities.filter(q => q.location_id === locationId);
  };

  const getLowStockItems = (locationId) => {
    const locQty = getLocationQuantities(locationId);
    return locQty.filter(q => {
      const item = items.find(i => i.id === q.price_list_item_id);
      return item && q.quantity < (item.min_stock_level || 5);
    });
  };

  if (locationsLoading || quantitiesLoading) {
    return <div className="p-6 text-center">Loading inventory...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-[#111827]">Warehouse & Vehicle Inventory</h1>
        <Button
          onClick={() => setShowCreateWarehouse(!showCreateWarehouse)}
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      {showCreateWarehouse && (
        <Card className="border-[#FAE008]">
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="Warehouse name"
              value={newWarehouseName}
              onChange={(e) => setNewWarehouseName(e.target.value)}
              className="text-[14px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => createWarehouseMutation.mutate(newWarehouseName)}
                disabled={!newWarehouseName || createWarehouseMutation.isPending}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                Create
              </Button>
              <Button
                onClick={() => setShowCreateWarehouse(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="warehouses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="warehouses" className="gap-2">
            <Warehouse className="w-4 h-4" />
            Warehouses ({warehouses.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-2">
            <Truck className="w-4 h-4" />
            Vehicles ({vehicles.length})
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <History className="w-4 h-4" />
            Movements
          </TabsTrigger>
        </TabsList>

        {/* WAREHOUSES TAB */}
        <TabsContent value="warehouses" className="space-y-4 mt-4">
          {warehouses.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              No warehouses yet. Create one to get started.
            </div>
          ) : (
            warehouses.map((warehouse) => {
              const warehouseQtys = getLocationQuantities(warehouse.id);
              const lowStockCount = getLowStockItems(warehouse.id).length;

              return (
                <Card key={warehouse.id} className="border-[#E5E7EB]">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-[18px]">{warehouse.name}</CardTitle>
                        {warehouse.description && (
                          <p className="text-[12px] text-[#6B7280] mt-1">{warehouse.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[24px] font-bold text-[#111827]">
                          {warehouseQtys.length}
                        </div>
                        <p className="text-[11px] text-[#6B7280]">Item types</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {lowStockCount > 0 && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[13px] text-amber-700">
                          {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} below minimum stock
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {warehouseQtys.length === 0 ? (
                        <p className="text-[13px] text-[#6B7280] py-4">No items in inventory</p>
                      ) : (
                        warehouseQtys.map((qty) => {
                          const item = items.find(i => i.id === qty.price_list_item_id);
                          const isLow = item && qty.quantity < (item.min_stock_level || 5);

                          return (
                            <div
                              key={qty.id}
                              className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                isLow ? 'bg-red-50 border-red-200' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-[#111827] truncate">
                                  {qty.item_name}
                                </p>
                                {item?.category && (
                                  <p className="text-[11px] text-[#6B7280]">{item.category}</p>
                                )}
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <p className={`text-[16px] font-bold ${
                                  isLow ? 'text-red-600' : 'text-[#111827]'
                                }`}>
                                  {qty.quantity}
                                </p>
                                {item && (
                                  <p className="text-[11px] text-[#6B7280]">
                                    Min: {item.min_stock_level || 5}
                                  </p>
                                )}
                              </div>
                              <Button
                                onClick={() => {
                                  setSelectedItem(qty);
                                  setTransferModalOpen(true);
                                }}
                                variant="ghost"
                                size="sm"
                                className="ml-2 p-1.5 h-8 w-8 hover:bg-[#FAE008]/20"
                                title="Transfer stock"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-[#6B7280]" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* VEHICLES TAB */}
        <TabsContent value="vehicles" className="space-y-4 mt-4">
          {vehicles.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              No vehicles yet. Create vehicles in Fleet management.
            </div>
          ) : (
            vehicles.map((vehicle) => {
              const vehicleQtys = getLocationQuantities(vehicle.id);

              return (
                <Card key={vehicle.id} className="border-[#E5E7EB]">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-[18px]">{vehicle.name}</CardTitle>
                        {vehicle.assigned_technician_name && (
                          <p className="text-[12px] text-[#6B7280] mt-1">
                            Assigned to: {vehicle.assigned_technician_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[24px] font-bold text-[#111827]">
                          {vehicleQtys.reduce((sum, q) => sum + (q.quantity || 0), 0)}
                        </div>
                        <p className="text-[11px] text-[#6B7280]">Total items</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {vehicleQtys.length === 0 ? (
                        <p className="text-[13px] text-[#6B7280] py-4">No items assigned</p>
                      ) : (
                        vehicleQtys.map((qty) => (
                          <div
                            key={qty.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#111827] truncate">
                                {qty.item_name}
                              </p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-[16px] font-bold text-[#111827]">
                                {qty.quantity}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* MOVEMENTS TAB */}
        <TabsContent value="movements" className="mt-4">
          <StockMovementHistory />
        </TabsContent>
      </Tabs>

      {/* TRANSFER MODAL */}
      {selectedItem && (
        <StockTransferModal
          open={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
        />
      )}
    </div>
  );
}