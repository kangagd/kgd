import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";

export default function ProjectPartsPanel({ project, parts = [], inventoryByItem = {} }) {
  const detectShortage = (part) => {
    // If part is already ordered/delivered/etc, it's not a shortage
    if (['Ordered', 'Back-ordered', 'Delivered', 'At Supplier', 'At Delivery Bay', 'In Warehouse Storage', 'With Technician', 'At Client Site'].includes(part.status)) {
      return false;
    }
    // If cancelled, no shortage
    if (part.status === 'Cancelled') return false;

    // If Pending, check if we have stock
    const requiredQty = part.quantity_required || 1;
    if (part.price_list_item_id) {
       const availableQty = inventoryByItem[part.price_list_item_id] || 0;
       return availableQty < requiredQty;
    }
    
    // If not linked to price list, we can't check stock, assume shortage if Pending? 
    // Or assume no shortage? Safe to assume shortage to prompt action.
    return true; 
  };

  const needed = parts.filter(p => detectShortage(p));
  const ready = parts.filter(p => !detectShortage(p));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Pick List</h3>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Print Pick List
        </Button>
      </div>

      {parts.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No parts required for this project.</p>
        </div>
      )}

      {needed.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-red-600 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Shortages ({needed.length})
          </h4>
          <div className="space-y-2">
            {needed.map(part => (
              <div key={part.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-red-900">{part.category}</div>
                  <div className="text-xs text-red-700 mt-0.5">
                    {part.supplier_name || 'No Supplier'} {part.order_reference ? `• ${part.order_reference}` : ''}
                  </div>
                  {part.price_list_item_id && (
                    <div className="text-xs text-red-600 mt-0.5">
                      Stock Available: {inventoryByItem[part.price_list_item_id] || 0}
                    </div>
                  )}
                </div>
                <div className="text-right">
                   <Badge variant="outline" className="bg-white border-red-200 text-red-800">
                     Qty: {part.quantity_required || 1}
                   </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mt-4 text-green-700 flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Ready to Pick / Assigned ({ready.length})
          </h4>
          <div className="space-y-2">
            {ready.map(part => (
              <div key={part.id} className="p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900">{part.category}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {part.location}
                    {part.status !== 'Pending' && ` • ${part.status}`}
                  </div>
                </div>
                <Badge variant="outline" className="bg-gray-50">
                  Qty: {part.quantity_required || 1}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}