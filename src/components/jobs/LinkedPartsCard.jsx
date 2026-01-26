import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Box, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";
import { useMemo } from "react";

export default function LinkedPartsCard({ job }) {
  // Determine job logistics type
  const isPickup = React.useMemo(() => {
    const t = `${job?.job_type_name || ""} ${job?.job_type || ""}`.toLowerCase();
    const purpose = `${job?.logistics_purpose || ""}`.toLowerCase();
    return purpose.includes("pickup") || t.includes("pickup") || t.includes("pick up");
  }, [job]);

  const isDelivery = React.useMemo(() => {
    const t = `${job?.job_type_name || ""} ${job?.job_type || ""}`.toLowerCase();
    const purpose = `${job?.logistics_purpose || ""}`.toLowerCase();
    return purpose.includes("delivery") || purpose.includes("deliver") || t.includes("delivery");
  }, [job]);

  // Fetch price list items for displaying linked item info
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems-for-linked-parts'],
    queryFn: () => base44.entities.PriceListItem.list('item'),
  });

  const priceListMap = useMemo(() => {
    return priceListItems.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [priceListItems]);

  // Fetch parts linked to this job
  const { data: linkedParts = [] } = useQuery({
  queryKey: ['linkedParts', job.id, job.project_id, job.purchase_order_id, job.visit_scope],
  queryFn: async () => {
    if (!job?.id) return [];

    const results = [];

    // 1) If job has a project, pull project parts and filter by linked_logistics_jobs
    if (job.project_id) {
      const projectParts = await base44.entities.Part.filter({ project_id: job.project_id });
      results.push(
        ...projectParts.filter(
          (p) => Array.isArray(p.linked_logistics_jobs) && p.linked_logistics_jobs.includes(job.id)
        )
      );
    }

    // 2) If job is tied to a PO, also pull PO parts (covers projectless PO logistics jobs)
    if (job.purchase_order_id) {
      const poParts = await base44.entities.Part.filter({ purchase_order_id: job.purchase_order_id });
      results.push(...poParts);
    }

    // 3) Check visit_scope for part references
    if (job.visit_scope && Array.isArray(job.visit_scope)) {
      const partIdsFromScope = job.visit_scope
        .filter(item => item.type === 'part' && item.ref_id)
        .map(item => item.ref_id);
      
      if (partIdsFromScope.length > 0) {
        const allParts = await base44.entities.Part.list();
        results.push(...allParts.filter(p => partIdsFromScope.includes(p.id)));
      }
    }

    // Dedupe by part.id
    const deduped = [];
    const seen = new Set();
    for (const p of results) {
      if (!p?.id) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      deduped.push(p);
    }

    return deduped;
  },
  enabled: !!job?.id,
});

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Box className="w-5 h-5 text-blue-600" />
          Linked Parts ({linkedParts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instruction Banner */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
          {isPickup && (
            <p className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              <strong>Task:</strong> Collect these parts from <strong>{job.address || 'Warehouse'}</strong> before heading to site.
            </p>
          )}
          {isDelivery && (
            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <strong>Task:</strong> Deliver these parts to <strong>{job.address}</strong>.
              </p>
              {/* Check job notes for delivery days info */}
              {job.notes && job.notes.includes("Usual delivery days:") && (
                 <p className="text-xs ml-6 text-blue-700 font-medium">
                    {job.notes.split("Usual delivery days:")[1].split(".")[0]}
                 </p>
              )}
            </div>
          )}
          {!isPickup && !isDelivery && (
            <p>These parts are associated with this job.</p>
          )}
        </div>

        {/* Parts List */}
        <div className="space-y-2">
          {linkedParts.map(part => (
            <div key={part.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border rounded-lg gap-2">
              <div className="flex items-start gap-3">
                <div className="bg-slate-100 p-2 rounded text-slate-600">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm text-slate-900">
                    {part.item_name || part.category}
                  </div>
                  {part.price_list_item_id && priceListMap[part.price_list_item_id] && (
                    <div className="text-xs text-slate-500 mb-0.5">
                      {priceListMap[part.price_list_item_id].item}
                      {priceListMap[part.price_list_item_id].sku ? ` • ${priceListMap[part.price_list_item_id].sku}` : ""}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    {part.supplier_name && <span className="mr-2">{part.supplier_name}</span>}
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {part.source_type?.split(' – ')[0]}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:justify-end mt-1 sm:mt-0">
                <Badge variant="outline" className="font-normal text-xs bg-white">
                  <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                  {part.location}
                </Badge>
                <Badge className={
                  part.status === 'Delivered' ? 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200' : 
                  part.status === 'Ordered' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200' :
                  'bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200'
                }>
                  {part.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}