import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Truck, MapPin, Calendar, Building2, Clock, ChevronDown, TestTube2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import ProjectPartsPanel from "./ProjectPartsPanel";
import LogisticsTimeline from "./LogisticsTimeline";
import SamplesAtClientPanel from "./SamplesAtClientPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { computePartsStatus } from "../domain/partsStatus";

export default function PartsTab({ project, parts, inventoryByItem }) {
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrdersByProject', project.id],
    queryFn: async () => {
      const pos = await base44.entities.PurchaseOrder.filter({ project_id: project.id });
      return pos;
    },
    enabled: !!project.id
  });

  // Enrich parts with PO status for accurate status derivation
  const enrichedParts = useMemo(() => {
    const poById = Object.fromEntries(purchaseOrders.map(po => [po.id, po]));
    return (parts || []).map(p => {
      const linkedPO = p.purchase_order_id ? poById[p.purchase_order_id] : null;
      return {
        ...p,
        po_status: p.po_status || linkedPO?.status || null,
        po_eta: p.po_eta || linkedPO?.eta || null,
        po_received_date: p.po_received_date || linkedPO?.received_date || null,
      };
    });
  }, [parts, purchaseOrders]);

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
      const allSamples = await base44.entities.SampleV2.list();
      return allSamples.filter(s => s.checked_out_project_id === project.id);
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

  // Compute parts status using the mapping utility with enriched parts
  const partsStatusMetrics = useMemo(() => {
    return computePartsStatus({
      parts: enrichedParts,
      purchaseOrders,
      logisticsJobs
    });
  }, [enrichedParts, purchaseOrders, logisticsJobs]);

  const { 
    requiredCount, 
    readyCount, 
    orderedCount, 
    missingCount, 
    partsReady, 
    openPOCount, 
    overduePOCount 
  } = partsStatusMetrics;

  return (
    <div className="space-y-6">
      {/* Parts Status Summary */}
      <Card className="border border-[#E5E7EB] shadow-sm bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[14px] font-semibold text-[#111827]">Parts Status</CardTitle>
            {requiredCount > 0 && (
              <div className={`flex items-center gap-1.5 text-[13px] font-medium ${partsReady ? 'text-green-600' : 'text-orange-600'}`}>
                {partsReady ? '✓ Parts ready' : '⚠ Parts not ready'}
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
              <div className="text-2xl font-bold text-green-600">{readyCount}</div>
              <div className="text-xs text-[#6B7280] mt-1">Ready</div>
            </div>
          </div>
          {(openPOCount > 0 || overduePOCount > 0) && (
            <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-center gap-4 text-xs text-[#6B7280]">
              {openPOCount > 0 && <span>Open POs: {openPOCount}</span>}
              {overduePOCount > 0 && <span className="text-orange-600 font-medium">Overdue POs: {overduePOCount}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => document.getElementById('parts-required')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:bg-[#FAE008]/5 transition-colors text-[#6B7280] hover:text-[#111827]"
        >
          Jump to Parts Required
        </button>
        <button
          onClick={() => document.getElementById('purchase-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:bg-[#FAE008]/5 transition-colors text-[#6B7280] hover:text-[#111827]"
        >
          Jump to Purchase Orders
        </button>
        <button
          onClick={() => document.getElementById('logistics')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:bg-[#FAE008]/5 transition-colors text-[#6B7280] hover:text-[#111827]"
        >
          Jump to Logistics
        </button>
        <button
          onClick={() => document.getElementById('samples')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] hover:bg-[#FAE008]/5 transition-colors text-[#6B7280] hover:text-[#111827]"
        >
          Jump to Samples
        </button>
      </div>

      {/* Parts Required */}
      <Card id="parts-required" className="border border-[#E5E7EB] shadow-sm scroll-mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#6B7280]" />
            Parts Required
            {parts.length > 0 && (
              <span className="text-sm font-normal text-[#6B7280]">({parts.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectPartsPanel 
            project={project} 
            parts={enrichedParts} 
            inventoryByItem={inventoryByItem} 
            onAddPart={() => window.triggerAddPart?.()}
            purchaseOrders={purchaseOrders}
            missingCount={missingCount}
          />
        </CardContent>
      </Card>

      {/* Purchase Orders - Moved inside ProjectPartsPanel */}

      {/* Logistics & Tracking */}
      <Collapsible open={logisticsExpanded} onOpenChange={setLogisticsExpanded}>
        <Card id="logistics" className="border border-[#E5E7EB] shadow-sm scroll-mt-6">
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
              {logisticsJobs.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">No logistics activity yet</p>
                </div>
              ) : (
                <LogisticsTimeline project={project} />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Samples */}
      <Collapsible open={samplesExpanded} onOpenChange={setSamplesExpanded}>
        <Card id="samples" className="border border-[#E5E7EB] shadow-sm scroll-mt-6">
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