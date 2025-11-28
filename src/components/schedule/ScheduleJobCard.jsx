import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, ExternalLink } from "lucide-react";
import { JobStatusBadge, JobTypeBadge, ProductTypeBadge } from "../common/StatusBadge";
import { Truck, Package } from "lucide-react";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { DuplicateDot } from "../common/DuplicateWarningCard";

export default function ScheduleJobCard({ job, onClick, onAddressClick, onProjectClick, techniciansLookup = {} }) {
  return (
    <Card
      onClick={onClick}
      className="p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#E5E7EB] rounded-xl bg-white"
    >
      {/* Top Row: Time + Status + Badges */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[#111827]">
            {job.scheduled_time || 'Time TBD'}
          </div>
          <DuplicateDot record={job} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {(job.job_type_name || "").match(/(Delivery|Pickup|Return)/i) && (
            <Badge className="bg-slate-800 text-white border-0 flex items-center gap-1 px-2">
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
      <div className="flex items-end justify-between mt-3">
        <div className="space-y-2 text-xs text-[#6B7280] flex-1 min-w-0 mr-2">
          {job.address_full && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddressClick(job);
                }}
                className="text-[#2563EB] hover:underline text-left truncate"
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
                className="text-[#2563EB] hover:underline flex items-center gap-1 truncate"
              >
                <ExternalLink className="w-3 h-3" />
                Project: {job.project_name}
              </button>
            </div>
          )}
        </div>

        {/* Technicians in bottom right */}
        {job.assigned_to && job.assigned_to.length > 0 && (
          <div className="flex-shrink-0">
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
    </Card>
  );
}