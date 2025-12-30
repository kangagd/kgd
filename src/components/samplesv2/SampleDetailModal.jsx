import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, MapPin, Package, FileText, Image } from "lucide-react";

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'lost': return 'bg-red-100 text-red-700';
    case 'retired': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getLocationColor = (locationType) => {
  switch (locationType) {
    case 'warehouse': return 'bg-blue-100 text-blue-700';
    case 'vehicle': return 'bg-purple-100 text-purple-700';
    case 'project': return 'bg-yellow-100 text-yellow-700';
    case 'unknown': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getMovementTypeLabel = (type) => {
  const labels = {
    checkout: 'Checked Out',
    return: 'Returned',
    transfer: 'Transferred',
    mark_lost: 'Marked Lost',
    mark_found: 'Marked Found',
    retire: 'Retired'
  };
  return labels[type] || type;
};

const safeFormatDate = (dateString, formatString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString);
  } catch {
    return '-';
  }
};

export default function SampleDetailModal({ open, onClose, sample }) {
  const { data: movements = [] } = useQuery({
    queryKey: ['sampleMovements', sample.id],
    queryFn: async () => {
      const mvts = await base44.entities.SampleMovementV2.filter({ sample_id: sample.id });
      return mvts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    enabled: open && !!sample.id,
  });

  const { data: project } = useQuery({
    queryKey: ['project', sample.checked_out_project_id],
    queryFn: () => base44.entities.Project.get(sample.checked_out_project_id),
    enabled: open && !!sample.checked_out_project_id,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const getVehicleName = (vehicleId) => {
    if (!vehicleId) return '';
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? (vehicle.name || vehicle.registration_plate) : vehicleId;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold">{sample.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Category</p>
              <p className="text-[14px] text-[#111827] font-medium">{sample.category || '-'}</p>
            </div>
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Sample Tag</p>
              <p className="text-[14px] text-[#111827] font-medium">{sample.sample_tag || '-'}</p>
            </div>
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Status</p>
              <Badge className={getStatusColor(sample.status)}>{sample.status}</Badge>
            </div>
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Current Location</p>
              <Badge className={getLocationColor(sample.current_location_type)}>
                {sample.current_location_type}
              </Badge>
            </div>
          </div>

          {/* Checkout Info */}
          {sample.checked_out_project_id && (
            <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-lg p-4">
              <h3 className="text-[14px] font-semibold text-[#92400E] mb-2">Currently Checked Out</h3>
              <div className="space-y-2 text-[13px] text-[#78350F]">
                <p>Project: {project?.title || sample.checked_out_project_id}</p>
                {sample.checked_out_at && (
                  <p>Checked out: {safeFormatDate(sample.checked_out_at, 'MMM d, yyyy h:mm a')}</p>
                )}
                {sample.due_back_at && (
                  <p>Due back: {safeFormatDate(sample.due_back_at, 'MMM d, yyyy')}</p>
                )}
              </div>
            </div>
          )}

          {/* Home Location */}
          <div>
            <p className="text-[13px] text-[#6B7280] mb-1">Home Location</p>
            <p className="text-[14px] text-[#111827]">
              {sample.home_location_type} 
              {sample.home_location_reference_id && sample.home_location_type === 'vehicle' ? ` (${getVehicleName(sample.home_location_reference_id)})` : sample.home_location_reference_id ? ` (${sample.home_location_reference_id})` : ''}
            </p>
          </div>

          {/* Last Seen */}
          {sample.last_seen_at && (
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Last Seen</p>
              <p className="text-[14px] text-[#111827]">
                {safeFormatDate(sample.last_seen_at, 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          )}

          {/* Notes */}
          {sample.notes && (
            <div>
              <p className="text-[13px] text-[#6B7280] mb-1">Notes</p>
              <p className="text-[14px] text-[#111827]">{sample.notes}</p>
            </div>
          )}

          {/* Attachments */}
          {sample.attachments && sample.attachments.length > 0 && (
            <div>
              <p className="text-[13px] text-[#6B7280] mb-2">Attachments</p>
              <div className="grid grid-cols-3 gap-2">
                {sample.attachments.map((url, idx) => (
                  <a 
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-[#E5E7EB] rounded-lg p-3 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <Image className="w-full h-20 object-cover rounded" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Movement Timeline */}
          <div>
            <h3 className="text-[16px] font-semibold text-[#111827] mb-3">Movement History</h3>
            {movements.length === 0 ? (
              <p className="text-[13px] text-[#6B7280]">No movements recorded</p>
            ) : (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div key={movement.id} className="border border-[#E5E7EB] rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#6B7280]" />
                        <span className="text-[13px] font-medium text-[#111827]">
                          {getMovementTypeLabel(movement.movement_type)}
                        </span>
                      </div>
                      <span className="text-[12px] text-[#6B7280]">
                        {safeFormatDate(movement.created_at, 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <div className="text-[13px] text-[#6B7280] space-y-1">
                      {movement.from_location_type && (
                        <p>From: {movement.from_location_type} {movement.from_location_reference_id && movement.from_location_type === 'vehicle' ? `(${getVehicleName(movement.from_location_reference_id)})` : movement.from_location_reference_id ? `(${movement.from_location_reference_id})` : ''}</p>
                      )}
                      {movement.to_location_type && (
                        <p>To: {movement.to_location_type} {movement.to_location_reference_id && movement.to_location_type === 'vehicle' ? `(${getVehicleName(movement.to_location_reference_id)})` : movement.to_location_reference_id ? `(${movement.to_location_reference_id})` : ''}</p>
                      )}
                      {movement.notes && (
                        <p className="text-[#4B5563] mt-2">{movement.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}