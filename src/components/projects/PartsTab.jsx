import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Truck, MapPin, Calendar, Building2, Clock, ChevronDown, TestTube2 } from "lucide-react";
import { format } from "date-fns";
import ProjectPartsPanel from "./ProjectPartsPanel";
import LogisticsTimeline from "./LogisticsTimeline";
import SamplesAtClientPanel from "./SamplesAtClientPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function PartsTab({ project, parts, inventoryByItem }) {
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['projectPurchaseOrders', project.id],
    queryFn: async () => {
      const pos = await base44.entities.PurchaseOrder.filter({ project_id: project.id });
      return pos;
    },
    enabled: !!project.id
  });

  const { data: logisticsJobs = [] } = useQuery({
    queryKey: ['projectLogisticsJobs', project.id],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ 
        project_id: project.id,
        $or: [
          { purchase_order_id: { $ne: null } },
          { third_party_trade_id: { $ne: null } },
          { 'sample_ids.0': { $exists: true } }
        ]
      });
      return jobs;
    },
    enabled: !!project.id
  });

  // Auto-expand logic for Logistics & Tracking
  const shouldAutoExpandLogistics = () => {
    // Check if any part is received but not yet allocated
    const hasReceivedNotAllocated = parts.some(p => 
      p.status === 'in_loading_bay' || p.status === 'in_storage'
    );
    
    // Check if any PO is ready for pickup
    const hasPoReadyForPickup = purchaseOrders.some(po => 
      po.status === 'ready_for_pickup' || po.ready_for_pickup === true
    );
    
    // Check if any logistics job is active/pending
    const hasActiveLogistics = logisticsJobs.some(j => 
      j.status !== 'Completed' && j.status !== 'Cancelled'
    );
    
    return hasReceivedNotAllocated || hasPoReadyForPickup || hasActiveLogistics;
  };

  const [logisticsExpanded, setLogisticsExpanded] = useState(() => shouldAutoExpandLogistics());
  const [samplesExpanded, setSamplesExpanded] = useState(false);

  const { data: samples = [] } = useQuery({
    queryKey: ['projectSamples', project.id],
    queryFn: async () => {
      const allSamples = await base44.entities.Sample.list();
      return allSamples.filter(s => s.current_location_project_id === project.id);
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
  const requiredCount = parts.length;
  const receivedReadyCount = parts.filter(p => 
    ['in_storage', 'in_vehicle', 'installed', 'in_loading_bay'].includes(p.status)
  ).length;
  const orderedCount = parts.filter(p => 
    ['on_order', 'in_transit'].includes(p.status)
  ).length;
  const missingCount = parts.filter(p => 
    ['pending', 'cancelled'].includes(p.status) || !p.status
  ).length;

  const isReady = missingCount === 0 && requiredCount > 0;

  return (
    <div className="space-y-6">
      {/* Parts Status Summary */}
      <Card className="border border-[#E5E7EB] shadow-sm bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px] font-semibold text-[#111827]">Parts Status</CardTitle>
            {requiredCount > 0 && (
              <div className={`flex items-center gap-1.5 text-[13px] font-medium ${isReady ? 'text-green-600' : 'text-orange-600'}`}>
                {isReady ? '✓ Parts ready' : '⚠ Parts not ready'}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-700">{requiredCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Required</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{missingCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Missing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{orderedCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Ordered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{receivedReadyCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Received</div>
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
      <Collapsible open={logisticsExpanded} onOpenChange={setLogisticsExpanded}>
        <Card className="border border-[#E5E7EB] shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#6B7280]" />
                  Logistics & Tracking
                  {logisticsJobs.length > 0 && (
                    <span className="text-sm font-normal text-[#6B7280]">
                      ({logisticsJobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled').length} active)
                    </span>
                  )}
                </CardTitle>
                <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${logisticsExpanded ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <LogisticsTimeline project={project} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Samples */}
      <Collapsible open={samplesExpanded} onOpenChange={setSamplesExpanded}>
        <Card className="border border-[#E5E7EB] shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
                  <TestTube2 className="w-5 h-5 text-[#6B7280]" />
                  Samples (Reference)
                  {samples.length > 0 && (
                    <span className="text-sm font-normal text-[#6B7280]">
                      ({samples.length})
                    </span>
                  )}
                </CardTitle>
                <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${samplesExpanded ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <SamplesAtClientPanel project={project} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}