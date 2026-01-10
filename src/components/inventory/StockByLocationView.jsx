import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warehouse, Truck, Package, ArrowRightLeft } from "lucide-react";

export default function StockByLocationView({ quantities, locations, onMoveStock }) {
  if (!quantities || quantities.length === 0) {
    return (
      <div className="text-[13px] text-[#6B7280]">
        No stock recorded in any location
      </div>
    );
  }

  const totalStock = quantities.reduce((sum, q) => sum + (q.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#6B7280]" />
          <span className="text-[13px] font-medium text-[#111827]">
            Stock by Location
          </span>
        </div>
        <Badge variant="outline" className="text-[12px]">
          Total: {totalStock}
        </Badge>
      </div>

      <div className="grid gap-2">
        {quantities.map((qty) => {
          const location = locations?.find(l => l.id === qty.location_id);
          const isWarehouse = location?.type === 'warehouse';
          const Icon = isWarehouse ? Warehouse : Truck;
          const displayName = qty.location_name || location?.name || 'Unknown Location';

          return (
            <Card key={qty.id} className="border border-[#E5E7EB]">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Icon className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[13px] text-[#111827]">
                      {displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={qty.quantity === 0 ? 'text-red-600' : 'text-green-600'}
                    >
                      {qty.quantity} units
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {onMoveStock && (
        <Button
          onClick={onMoveStock}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Move Between Locations
        </Button>
      )}
    </div>
  );
}