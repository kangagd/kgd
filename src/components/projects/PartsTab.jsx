import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Truck, MapPin, Calendar, Building2, Clock } from "lucide-react";
import { format } from "date-fns";
import ProjectPartsPanel from "./ProjectPartsPanel";
import LogisticsTimeline from "./LogisticsTimeline";
import SamplesAtClientPanel from "./SamplesAtClientPanel";

export default function PartsTab({ project, parts, inventoryByItem }) {
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['projectPurchaseOrders', project.id],
    queryFn: async () => {
      const pos = await base44.entities.PurchaseOrder.filter({ project_id: project.id });
      return pos;
    },
    enabled: !!project.id
  });

  const poStatusColors = {
    "Draft": "bg-slate-100 text-slate-700",
    "Sent": "bg-blue-100 text-blue-700",
    "Confirmed": "bg-purple-100 text-purple-700",
    "Partially Received": "bg-orange-100 text-orange-700",
    "Received": "bg-green-100 text-green-700",
    "Cancelled": "bg-red-100 text-red-700"
  };

  // Calculate parts status summary
  const partsReadyCount = parts.filter(p => 
    ['in_storage', 'in_vehicle', 'installed'].includes(p.status)
  ).length;
  const partsOnOrderCount = parts.filter(p => 
    ['on_order', 'in_transit'].includes(p.status)
  ).length;
  const partsPendingCount = parts.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Parts Status Summary */}
      <Card className="border border-[#E5E7EB] shadow-sm bg-gradient-to-br from-white to-slate-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{partsReadyCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Ready</div>
            </div>
            <div className="text-center border-x border-[#E5E7EB]">
              <div className="text-2xl font-bold text-orange-600">{partsOnOrderCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">On Order</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-600">{partsPendingCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Required */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#6B7280]" />
            Parts Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectPartsPanel 
            project={project} 
            parts={parts} 
            inventoryByItem={inventoryByItem} 
            onAddPart={() => window.triggerAddPart?.()}
          />
        </CardContent>
      </Card>

      {/* Purchase Orders */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#6B7280]" />
            Purchase Orders ({purchaseOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <div className="text-center py-6 text-[14px] text-[#9CA3AF]">
              No purchase orders yet
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="border border-[#E5E7EB] rounded-lg p-4 hover:border-[#FAE008] transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium text-[15px] text-[#111827] mb-1">
                        PO #{po.po_number || po.id.slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                        <Building2 className="w-3.5 h-3.5" />
                        {po.supplier_name || 'Unknown Supplier'}
                      </div>
                    </div>
                    <Badge className={`${poStatusColors[po.status]} font-medium text-[12px]`}>
                      {po.status}
                    </Badge>
                  </div>
                  
                  {po.expected_delivery_date && (
                    <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>ETA: {format(new Date(po.expected_delivery_date), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                  
                  {po.notes && (
                    <div className="mt-2 text-[13px] text-[#6B7280] line-clamp-2">
                      {po.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logistics & Tracking */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#6B7280]" />
            Logistics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LogisticsTimeline project={project} />
        </CardContent>
      </Card>

      {/* Samples at Client */}
      <SamplesAtClientPanel project={project} />
    </div>
  );
}