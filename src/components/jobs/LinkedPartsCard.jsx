import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function LinkedPartsCard({ job }) {
  const { data: parts = [] } = useQuery({
    queryKey: ['jobParts', job.id],
    queryFn: async () => {
        if (!job.part_ids || job.part_ids.length === 0) return [];
        const fetchedParts = await Promise.all(
            job.part_ids.map(id => base44.entities.Part.get(id).catch(() => null))
        );
        return fetchedParts.filter(Boolean);
    },
    enabled: !!(job.part_ids && job.part_ids.length > 0)
  });

  if (!job.part_ids || job.part_ids.length === 0) {
      if (job.job_category === 'Logistics') {
          return (
            <Card className="border border-orange-200 bg-orange-50 mb-4">
                <CardContent className="p-4 flex items-center gap-2 text-orange-800">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">No parts linked to this logistics job.</span>
                </CardContent>
            </Card>
          );
      }
      return null;
  }

  return (
    <Card className="border border-blue-200 bg-blue-50/50 mb-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-900">
          <Truck className="w-4 h-4" />
          Related Parts & Materials
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          {parts.map(part => (
            <div key={part.id} className="bg-white border border-blue-100 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">{part.category}</div>
                <div className="text-xs text-slate-500">
                    {part.supplier_name && <span>{part.supplier_name} • </span>}
                    {part.source_type}
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className="bg-slate-50">{part.status}</Badge>
                 <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                     <MapPin className="w-3 h-3" />
                     {part.location}
                 </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}