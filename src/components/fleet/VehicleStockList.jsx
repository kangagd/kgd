import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, AlertTriangle, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VehicleStockList({ stock, onMarkUsed, onAdjust, isLoading, inventoryByItem }) {
  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading inventory...</div>;
  }

  if (stock.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No items found</p>
      </div>
    );
  }

  // Group by category
  const grouped = stock.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            {category}
          </h4>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
            {items.map((item) => {
              const isLowStock = item.quantity_on_hand < (item.minimum_target_quantity || 0);
              
              return (
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{item.product_name}</span>
                      {isLowStock && (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.sku}</span>
                      {item.location_label && (
                        <span>• {item.location_label}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.quantity_on_hand}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Min: {item.minimum_target_quantity || 0}
                      </div>
                      {inventoryByItem && inventoryByItem[item.price_list_item_id] !== undefined && (
                        <div className="text-[10px] text-blue-600 mt-0.5 font-medium">
                          Tracked: {inventoryByItem[item.price_list_item_id]}
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-gray-400 hover:text-gray-700">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onMarkUsed(item)}>
                          Mark Used on Job...
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAdjust(item)}>
                          Adjust Quantity...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}