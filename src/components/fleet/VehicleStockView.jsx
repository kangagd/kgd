import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function VehicleStockView({ vehicleId }) {
   // Fetch vehicle's InventoryLocation via vehicle_id mapping
   // Only resolve active locations
   const { data: vehicleLocation, isLoading: isLocationLoading } = useQuery({
     queryKey: ['vehicleLocation', vehicleId],
     queryFn: async () => {
       const locations = await base44.entities.InventoryLocation.filter({
         type: 'vehicle',
         vehicle_id: vehicleId,
         is_active: true
       });
       return locations[0] || null;
     },
     enabled: !!vehicleId
   });

   // Fetch inventory quantities for this vehicle location
   const { data: quantities = [], isLoading: isQuantitiesLoading } = useQuery({
     queryKey: ['vehicleInventoryQuantities', vehicleLocation?.id],
     queryFn: async () => {
       if (!vehicleLocation?.id) return [];
       const qty = await base44.entities.InventoryQuantity.filter({
         location_id: vehicleLocation.id
       });
       return qty;
     },
     enabled: !!vehicleLocation?.id
   });

   // Fetch price list items to get names and details
   const { data: priceListItems = [] } = useQuery({
     queryKey: ['priceListItems'],
     queryFn: () => base44.entities.PriceListItem.list('item')
   });

   const itemMap = useMemo(() => {
     return priceListItems.reduce((acc, item) => {
       acc[item.id] = item;
       return acc;
     }, {});
   }, [priceListItems]);

   // Transform InventoryQuantity to stock view
   const stockByItem = useMemo(() => {
     return quantities
       .map(q => {
         const item = itemMap[q.price_list_item_id];
         return {
           id: q.id,
           price_list_item_id: q.price_list_item_id,
           item_name: q.item_name || item?.item || 'Unknown Item',
           quantity: Number(q.quantity ?? q.qty ?? 0),
           category: item?.category || 'Stock'
         };
       })
       .filter(item => item.quantity > 0);
   }, [quantities, itemMap]);

   const isLoading = isLocationLoading || isQuantitiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading stock...</div>
      </div>
    );
  }

  if (!vehicleLocation && !isLocationLoading) {
     return (
       <Card className="border-red-200 bg-red-50">
         <CardContent className="pt-6">
           <div className="flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
             <div>
               <h3 className="font-semibold text-red-900 mb-1">Vehicle Inventory Location Missing</h3>
               <p className="text-sm text-red-700">
                 This vehicle doesn't have an InventoryLocation configured. Run the 'Ensure Vehicle Locations' admin tool to fix this.
               </p>
             </div>
           </div>
         </CardContent>
       </Card>
     );
   }

  if (stockByItem.length === 0) {
     return (
       <Card>
         <CardContent className="pt-6">
           <div className="flex flex-col items-center justify-center py-12 text-center">
             <Package className="w-12 h-12 text-muted-foreground mb-4" />
             <h3 className="text-lg font-semibold mb-2">No Stock in Vehicle</h3>
             <p className="text-sm text-muted-foreground max-w-md">
               This vehicle currently has no stock. Stock appears after items are received from purchase orders or transferred from the warehouse.
             </p>
           </div>
         </CardContent>
       </Card>
     );
   }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5" />
            Current Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold">{stockByItem.length}</div>
              <div className="text-sm text-muted-foreground">Unique Items</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold">
                {stockByItem.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Quantity</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items in Vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Item</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Quantity</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Category</th>
                </tr>
              </thead>
              <tbody>
                {stockByItem.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <span className="font-medium text-sm">{item.item_name}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant="secondary" className="font-mono">
                        {item.quantity}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {item.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Vehicle-Scoped Stock</h4>
              <p className="text-sm text-blue-700 mt-1">
                This shows only stock currently at this vehicle. Use transfers or logistics jobs to move stock between locations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}