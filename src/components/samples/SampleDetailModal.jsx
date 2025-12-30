import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MapPin, Package, Calendar, Clock, FileText, History, X } from "lucide-react";
import SampleMovementHistoryModal from "./SampleMovementHistoryModal";
import SampleQuickActions from "./SampleQuickActions";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SampleDetailModal({ sample, onClose }) {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', sample.checked_out_project_id],
    queryFn: () => base44.entities.Project.get(sample.checked_out_project_id),
    enabled: !!sample.checked_out_project_id,
  });

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', sample.current_location_reference_id],
    queryFn: () => base44.entities.Vehicle.get(sample.current_location_reference_id),
    enabled: sample.current_location_type === 'vehicle' && !!sample.current_location_reference_id,
  });

  const { data: homeVehicle } = useQuery({
    queryKey: ['vehicle', sample.home_location_reference_id],
    queryFn: () => base44.entities.Vehicle.get(sample.home_location_reference_id),
    enabled: sample.home_location_type === 'vehicle' && !!sample.home_location_reference_id,
  });

  const getStatusBadge = (status) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'lost') return 'bg-red-100 text-red-700';
    if (status === 'retired') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getLocationDisplay = () => {
    const type = sample.current_location_type;
    if (type === 'warehouse') return 'Warehouse';
    if (type === 'unknown') return 'Unknown';
    if (type === 'vehicle') return vehicle ? `Vehicle: ${vehicle.name}` : 'Vehicle';
    if (type === 'project') return project ? `Project: ${project.title}` : 'At Project';
    return type;
  };

  const getHomeLocationDisplay = () => {
    const type = sample.home_location_type;
    if (type === 'warehouse') return 'Warehouse';
    if (type === 'vehicle') return homeVehicle ? `Vehicle: ${homeVehicle.name}` : 'Vehicle';
    return type;
  };

  const isOverdue = sample.checked_out_project_id && sample.due_back_at && sample.due_back_at < new Date().toISOString().split('T')[0];

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-[22px] font-semibold text-[#111827] mb-2">
                  {sample.name}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusBadge(sample.status)}>
                    {sample.status}
                  </Badge>
                  {sample.sample_tag && (
                    <span className="text-[13px] text-[#6B7280]">
                      Tag: <span className="font-medium text-[#111827]">{sample.sample_tag}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sample.status === 'active' && <SampleQuickActions sample={sample} />}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Location Info */}
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[13px] font-medium text-[#6B7280]">Current Location:</span>
                  <span className="text-[14px] font-semibold text-[#111827]">{getLocationDisplay()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[13px] font-medium text-[#6B7280]">Home Location:</span>
                  <span className="text-[14px] text-[#111827]">{getHomeLocationDisplay()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Checkout Info */}
            {sample.checked_out_project_id && (
              <Card className="border border-[#DBEAFE] bg-[#EFF6FF]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[#1E40AF]">Checked Out</span>
                    {isOverdue && (
                      <Badge className="bg-red-100 text-red-700">OVERDUE</Badge>
                    )}
                  </div>
                  {project && (
                    <div>
                      <span className="text-[13px] text-[#3B82F6]">Project:</span>
                      <button
                        onClick={() => navigate(`${createPageUrl('Projects')}?projectId=${project.id}`)}
                        className="ml-2 text-[14px] font-medium text-[#2563EB] hover:underline"
                      >
                        {project.title}
                      </button>
                    </div>
                  )}
                  {sample.checked_out_at && (
                    <div className="flex items-center gap-2 text-[13px] text-[#3B82F6]">
                      <Clock className="w-4 h-4" />
                      Checked out: {new Date(sample.checked_out_at).toLocaleDateString()}
                    </div>
                  )}
                  {sample.due_back_at && (
                    <div className={`flex items-center gap-2 text-[13px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-[#3B82F6]'}`}>
                      <Calendar className="w-4 h-4" />
                      Due back: {new Date(sample.due_back_at).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sample Details */}
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-4 space-y-3">
                {sample.category && (
                  <div>
                    <span className="text-[13px] font-medium text-[#6B7280]">Category:</span>
                    <span className="ml-2 text-[14px] text-[#111827]">{sample.category}</span>
                  </div>
                )}
                {sample.last_seen_at && (
                  <div>
                    <span className="text-[13px] font-medium text-[#6B7280]">Last Seen:</span>
                    <span className="ml-2 text-[14px] text-[#111827]">
                      {new Date(sample.last_seen_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {sample.notes && (
                  <div>
                    <span className="text-[13px] font-medium text-[#6B7280] block mb-1">Notes:</span>
                    <div className="text-[14px] text-[#111827] bg-[#F9FAFB] p-3 rounded-lg">
                      {sample.notes}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            {sample.attachments && sample.attachments.length > 0 && (
              <Card className="border border-[#E5E7EB]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[14px] font-semibold text-[#111827]">Attachments</span>
                  </div>
                  <div className="space-y-2">
                    {sample.attachments.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[14px] text-[#2563EB] hover:underline"
                      >
                        Attachment {idx + 1}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History Button */}
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="w-full"
            >
              <History className="w-4 h-4 mr-2" />
              View Movement History
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showHistory && (
        <SampleMovementHistoryModal
          sample={sample}
          open={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}