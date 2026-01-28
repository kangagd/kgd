import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fnData } from '@/components/utils/fnData';

export default function POLogisticsJobsSection({ purchaseOrderId }) {
  // Fetch all logistics jobs linked to this PO
  const { data: linkedJobs = [], isLoading } = useQuery({
    queryKey: ['poLogisticsJobs', purchaseOrderId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPoLogisticsJobs', { 
        purchase_order_id: purchaseOrderId 
      });
      const data = fnData(response);
      const jobs = data.jobs ?? data.data ?? [];
      return jobs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!purchaseOrderId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Loading logistics activity...</div>
        </CardContent>
      </Card>
    );
  }

  if (linkedJobs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center py-4">
            No logistics jobs yet for this PO
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Logistics Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linkedJobs.map((job) => (
          <div key={job.id} className="p-3 border border-[#E5E7EB] rounded-lg space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-[#111827]">Job #{job.job_number}</div>
                <div className="text-xs text-[#6B7280] mt-0.5">
                  {job.logistics_purpose?.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {job.legacy_flag && (
                  <Badge className="bg-orange-100 text-orange-800 text-[11px]">Legacy</Badge>
                )}
                <Badge className={`text-[11px] ${
                  job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  job.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </Badge>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {job.scheduled_date && (
                <div className="col-span-1">
                  <div className="text-[#6B7280] font-medium">Scheduled</div>
                  <div className="text-[#111827]">{format(new Date(job.scheduled_date), 'MMM d')}</div>
                </div>
              )}
              {job.assigned_to?.length > 0 && (
                <div className="col-span-1">
                  <div className="text-[#6B7280] font-medium">Assigned</div>
                  <div className="text-[#111827] truncate">{job.assigned_to_name?.[0]}</div>
                </div>
              )}
              {job.origin_address && (
                <div className="col-span-2">
                  <div className="text-[#6B7280] font-medium">From</div>
                  <div className="text-[#111827] text-xs">{job.origin_address}</div>
                </div>
              )}
              {job.destination_address && (
                <div className="col-span-2">
                  <div className="text-[#6B7280] font-medium">To</div>
                  <div className="text-[#111827] text-xs">{job.destination_address}</div>
                </div>
              )}
            </div>

            {/* Legacy Warning */}
            {job.legacy_flag && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex gap-2">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>Legacy job: reference only. No stock actions permitted.</span>
              </div>
            )}

            {/* Stock Transfer Status (if not legacy) */}
            {!job.legacy_flag && job.stock_transfer_status && (
              <div className="text-xs">
                <span className="text-[#6B7280]">Stock transfer: </span>
                <Badge variant="outline" className="text-[11px]">
                  {job.stock_transfer_status}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}