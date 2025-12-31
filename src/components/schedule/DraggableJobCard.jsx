import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, ExternalLink, GripVertical, Truck } from "lucide-react";
import { JobStatusBadge, JobTypeBadge, ProductTypeBadge } from "../common/StatusBadge";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { DuplicateDot } from "../common/DuplicateWarningCard";

export default function DraggableJobCard({ 
  job, 
  onClick, 
  onAddressClick, 
  onProjectClick,
  isDragging = false,
  techniciansLookup = {},
  hasActiveCheckIn = false
}) {
  return (
    <Card
      className={`p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing border border-[#E5E7EB] rounded-xl bg-white ${
        isDragging ? 'opacity-70 shadow-lg ring-2 ring-[#FAE008] rotate-1' : ''
      } ${hasActiveCheckIn ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}`}
    >
      {/* Drag Handle */}
      <div className="flex items-start gap-2">
        <div 
          className="flex-shrink-0 p-1 -ml-1 hover:bg-[#F3F4F6] rounded transition-colors"
        >
          <GripVertical className="w-4 h-4 text-[#9CA3AF]" />
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          {/* Top Row: Time + Status + Badges */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-[#111827]">
                {job.scheduled_time || 'Time TBD'}
              </div>
              <DuplicateDot record={job} />
              {hasActiveCheckIn && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium border border-emerald-200">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  In Progress
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(job.job_type_name || "").match(/(Delivery|Pickup|Return)/i) && (
                <Badge className="bg-slate-800 text-white border-0 flex items-center gap-1 px-2 text-[10px]">
                  <Truck className="w-3 h-3" />
                  Logistics
                </Badge>
              )}
              {job.job_type_name && (
                <JobTypeBadge value={job.job_type_name} />
              )}
              {job.product && (
                <ProductTypeBadge value={job.product} />
              )}
              <JobStatusBadge value={job.status} />
            </div>
          </div>

          {/* Middle Section: Job Info */}
          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-2">
              <Briefcase className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#111827]">
                  Job #{job.job_number}
                </div>
                <div className="text-sm text-[#4B5563]">
                  {job.customer_name}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Address + Project + Technicians */}
          <div className="space-y-2">
            <div className="space-y-2 text-xs text-[#6B7280]">
              {job.address_full && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddressClick(job);
                    }}
                    className="text-[#2563EB] hover:underline text-left break-words"
                  >
                    {job.address_full}
                  </button>
                </div>
              )}
              {job.project_id && job.project_name && (
                <div className="flex items-start gap-2 ml-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectClick(job.project_id);
                    }}
                    className="text-[#2563EB] hover:underline flex items-center gap-1 break-words"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="break-words">Project: {job.project_name}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Technicians below */}
            {job.assigned_to && job.assigned_to.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <TechnicianAvatarGroup
                  technicians={job.assigned_to.map((email, idx) => {
                    const normalized = email.toLowerCase();
                    const tech = techniciansLookup?.[normalized];
                    return {
                      email,
                      display_name: tech?.display_name || tech?.full_name || job.assigned_to_name?.[idx] || email,
                      full_name: tech?.full_name || job.assigned_to_name?.[idx] || email,
                      id: email
                    };
                  })}
                  maxDisplay={3}
                  size="xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}