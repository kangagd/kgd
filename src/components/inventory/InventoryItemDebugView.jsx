import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function InventoryItemDebugView({ priceListItemId }) {
  const { data: item } = useQuery({
    queryKey: ['priceListItem', priceListItemId],
    queryFn: () => base44.entities.PriceListItem.get(priceListItemId),
  });

  const { data: quantities = [], isLoading: qtyLoading } = useQuery({
    queryKey: ['inventoryQuantities', priceListItemId],
    queryFn: async () => {
      const qtys = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
      });
      
      // Fetch location details for each
      const withLocations = await Promise.all(
        qtys.map(async (qty) => {
          try {
            const loc = await base44.entities.InventoryLocation.get(qty.location_id);
            return { ...qty, location: loc };
          } catch {
            return { ...qty, location: null };
          }
        })
      );
      
      return withLocations;
    },
  });

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ['stockMovements', priceListItemId],
    queryFn: async () => {
      const all = await base44.entities.StockMovement.list();
      return all
        .filter((m) => m.price_list_item_id === priceListItemId)
        .sort((a, b) => new Date(b.performed_at || b.created_date) - new Date(a.performed_at || a.created_date))
        .slice(0, 20);
    },
  });

  const totalOnHand = quantities.reduce((sum, q) => sum + (q.quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Item Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{item?.item || 'Loading...'}</CardTitle>
              {item?.sku && <p className="text-sm text-slate-500 mt-1">SKU: {item.sku}</p>}
            </div>
            <Badge variant="secondary">{item?.category || 'N/A'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Unit Cost</p>
              <p className="font-semibold text-slate-900">${item?.unit_cost || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">Sell Price</p>
              <p className="font-semibold text-slate-900">${item?.price || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">Total On-Hand</p>
              <p className="font-semibold text-lg text-green-600">{totalOnHand} units</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock by Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock by Location</CardTitle>
        </CardHeader>
        <CardContent>
          {qtyLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : quantities.length === 0 ? (
            <p className="text-slate-500 text-sm">No stock records found</p>
          ) : (
            <div className="space-y-3">
              {quantities.map((qty) => (
                <div key={qty.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {qty.location?.name || qty.location_name || 'Unknown Location'}
                      </p>
                      {qty.location && (
                        <p className="text-xs text-slate-500 mt-1 capitalize">
                          Type: {qty.location.type}
                          {qty.location.vehicle_id && ` • Vehicle ID: ${qty.location.vehicle_id}`}
                          {qty.location.supplier_id && ` • Supplier ID: ${qty.location.supplier_id}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">{qty.quantity}</p>
                      <p className="text-xs text-slate-500">units</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">ID: {qty.id}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 20 Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : movements.length === 0 ? (
            <p className="text-slate-500 text-sm">No movements recorded</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {movements.map((mov) => (
                <div key={mov.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {mov.source === 'po_receipt' && '📦 PO Receipt'}
                        {mov.source === 'logistics_job' && '🚚 Logistics Transfer'}
                        {mov.source === 'transfer' && '↔️ Transfer'}
                        {mov.source === 'adjustment' && '⚙️ Adjustment'}
                        {!['po_receipt', 'logistics_job', 'transfer', 'adjustment'].includes(mov.source) && `📝 ${mov.source}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(mov.performed_at || mov.created_date).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={mov.quantity > 0 ? 'default' : 'destructive'}>
                      {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                    </Badge>
                  </div>
                  
                  {mov.from_location_name && mov.to_location_name && (
                    <p className="text-xs text-slate-600 mb-1">
                      {mov.from_location_name} → {mov.to_location_name}
                    </p>
                  )}
                  
                  {mov.notes && <p className="text-xs text-slate-600 italic mb-1">"{mov.notes}"</p>}
                  
                  <p className="text-xs text-slate-400">
                    By: {mov.performed_by_user_name || mov.performed_by_user_email || 'System'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}