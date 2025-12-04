import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Box, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";

export default function LinkedPartsCard({ job }) {
  // Fetch parts linked to this job
  const { data: linkedParts = [] } = useQuery({
    queryKey: ['linkedParts', job.id],
    queryFn: async () => {
      if (!job.project_id) return [];
      // Optimization: fetch project parts and filter in memory since 'linked_logistics_jobs' is array
      const projectParts = await base44.entities.Part.filter({ project_id: job.project_id });
      return projectParts.filter(p => p.linked_logistics_jobs && p.linked_logistics_jobs.includes(job.id));
    },
    enabled: !!job.id
  });

  if (!linkedParts || linkedParts.length === 0) {
    return null;
  }

  const isPickup = (job.job_type_name || "").toLowerCase().includes("pickup");
  const isDelivery = (job.job_type_name || "").toLowerCase().includes("delivery");

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
            <p className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              <strong>Task:</strong> Deliver these parts to <strong>{job.address}</strong>.
            </p>
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
                  <div className="font-medium text-sm text-slate-900">{part.category}</div>
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