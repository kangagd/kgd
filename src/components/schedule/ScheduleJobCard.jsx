import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, ExternalLink } from "lucide-react";
import { JobStatusBadge, JobTypeBadge, ProductTypeBadge } from "../common/StatusBadge";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";

export default function ScheduleJobCard({ job, onClick, onAddressClick, onProjectClick }) {
  return (
    <Card
      onClick={onClick}
      className="p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#E5E7EB] rounded-xl bg-white"
    >
      {/* Top Row: Time + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#111827]">
          {job.scheduled_time || 'Time TBD'}
        </div>
        <JobStatusBadge value={job.status} />
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

        {/* Technicians */}
        {job.assigned_to && job.assigned_to.length > 0 && (
          <div className="flex items-center gap-2 ml-6">
            <TechnicianAvatarGroup
              technicians={job.assigned_to.map((email, idx) => ({
                email,
                full_name: job.assigned_to_name?.[idx] || email,
                id: email
              }))}
              maxDisplay={3}
              size="xs"
            />
          </div>
        )}

        {/* Job Type + Product Chips */}
        <div className="flex flex-wrap gap-2 ml-6">
          {job.job_type_name && (
            <JobTypeBadge value={job.job_type_name} />
          )}
          {job.product && (
            <ProductTypeBadge value={job.product} />
          )}
        </div>
      </div>

      {/* Bottom Row: Address + Project */}
      <div className="space-y-2 text-xs text-[#6B7280]">
        {job.address_full && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddressClick(job);
              }}
              className="text-[#2563EB] hover:underline text-left"
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
              className="text-[#2563EB] hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Project: {job.project_name}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}