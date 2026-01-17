import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, AlertCircle, CheckCircle2, FileText, Truck, Package, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  'Open': { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'Open' },
  'Scheduled': { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'Scheduled' },
  'Completed': { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Completed' },
  'Cancelled': { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Cancelled' }
};

const logisticsPurposeConfig = {
  'po_delivery_to_warehouse': { icon: Truck, label: 'PO Delivery to Warehouse' },
  'po_pickup_from_supplier': { icon: Package, label: 'PO Pickup from Supplier' },
  'part_pickup_for_install': { icon: Package, label: 'Part Pickup for Install' },
  'manual_client_dropoff': { icon: Truck, label: 'Client Dropoff' },
  'sample_dropoff': { icon: Package, label: 'Sample Dropoff' },
  'sample_pickup': { icon: Package, label: 'Sample Pickup' }
};

export default function LogisticsJobCard({ job, onSelect, linkedPO }) {
  const status = job.status || 'Open';
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  const purposeConfig = logisticsPurposeConfig[job.logistics_purpose] || { icon: Truck, label: job.logistics_purpose };
  const PurposeIcon = purposeConfig.icon;

  const isLegacy = job.legacy_flag === true;
  const isCompleted = job.status === 'Completed';

  return (
    <Card className="hover:shadow-md transition-all cursor-pointer">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-[#111827]">Job #{job.job_number}</h3>
              {isLegacy && (
                <Badge className="bg-orange-100 text-orange-800 text-[11px]">Legacy</Badge>
              )}
              <Badge className={config.color}>{config.label}</Badge>
            </div>
            
            {/* Purpose */}
            <div className="flex items-center gap-2 text-sm text-[#4B5563]">
              <PurposeIcon className="w-4 h-4" />
              <span>{purposeConfig.label}</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
        </div>

        {/* PO Link */}
        {linkedPO && (
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-blue-900 font-medium">PO-{linkedPO.po_number}</span>
              <span className="text-blue-700 text-xs">({linkedPO.status})</span>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs text-[#6B7280]">
          {job.scheduled_date && (
            <div>
              <div className="font-medium text-[#111827]">Scheduled</div>
              <div>{format(new Date(job.scheduled_date), 'MMM d, yyyy')}</div>
            </div>
          )}
          {job.completion_notes && (
            <div>
              <div className="font-medium text-[#111827]">Notes</div>
              <div className="truncate italic">{job.completion_notes}</div>
            </div>
          )}
        </div>

        {/* Legacy Warning */}
        {isLegacy && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800">
              <p className="font-medium">Legacy job</p>
              <p className="mt-0.5">No stock actions. Reference only.</p>
            </div>
          </div>
        )}

        {/* Stock Transfer Status */}
        {!isLegacy && job.stock_transfer_status && (
          <div className="text-xs">
            <span className="text-[#6B7280]">Stock transfer: </span>
            <Badge variant="outline" className={`text-[11px] ${
              job.stock_transfer_status === 'completed' ? 'bg-green-50 border-green-200' :
              job.stock_transfer_status === 'skipped' ? 'bg-gray-50 border-gray-200' :
              'bg-amber-50 border-amber-200'
            }`}>
              {job.stock_transfer_status}
            </Badge>
          </div>
        )}

        {/* Action */}
        <Button
          onClick={() => onSelect(job)}
          variant="outline"
          className="w-full text-xs"
        >
          View Details
        </Button>
      </div>
    </Card>
  );
}