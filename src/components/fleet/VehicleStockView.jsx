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
  // Fetch all stock movements for this vehicle
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stockMovements', vehicleId],
    queryFn: async () => {
      const allMovements = await base44.entities.StockMovement.list();
      return allMovements.filter(m => 
        m.to_vehicle_id === vehicleId || m.from_vehicle_id === vehicleId
      );
    }
  });

  // Compute current stock by SKU
  const stockByItem = useMemo(() => {
    const items = new Map();

    for (const movement of movements) {
      const key = movement.sku_id || movement.part_id || movement.item_name;
      if (!key) continue;

      if (!items.has(key)) {
        items.set(key, {
          sku_id: movement.sku_id,
          part_id: movement.part_id,
          item_name: movement.item_name,
          quantity: 0,
          lastMovement: null,
          lastJob: null
        });
      }

      const item = items.get(key);

      // Add if moving TO this vehicle
      if (movement.to_vehicle_id === vehicleId) {
        item.quantity += movement.quantity;
      }

      // Subtract if moving FROM this vehicle
      if (movement.from_vehicle_id === vehicleId) {
        item.quantity -= movement.quantity;
      }

      // Track last movement
      if (!item.lastMovement || new Date(movement.performed_at) > new Date(item.lastMovement)) {
        item.lastMovement = movement.performed_at;
        item.lastJob = movement.job_id;
      }
    }

    // Filter out items with zero quantity
    return Array.from(items.values()).filter(item => item.quantity > 0);
  }, [movements, vehicleId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading stock...</div>
      </div>
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
              This vehicle has no current stock. Stock will appear here when logistics jobs move items into this vehicle.
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
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Last Movement</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Source Job</th>
                </tr>
              </thead>
              <tbody>
                {stockByItem.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{item.item_name || 'Unknown Item'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant="secondary" className="font-mono">
                        {item.quantity}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {item.lastMovement ? format(new Date(item.lastMovement), 'MMM d, yyyy h:mm a') : 'N/A'}
                    </td>
                    <td className="py-3 px-2">
                      {item.lastJob ? (
                        <Link
                          to={`${createPageUrl('Jobs')}?jobId=${item.lastJob}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View Job
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-900">Read-Only View</h4>
              <p className="text-sm text-amber-700 mt-1">
                Vehicle stock is computed from StockMovement records. Stock updates automatically when logistics jobs are completed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}