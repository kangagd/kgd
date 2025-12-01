import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Phone, Navigation, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { createPageUrl } from "@/utils";
import { JobTypeBadge, ProductTypeBadge, JobStatusBadge } from "../common/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const statusColors = {
  "Open": "bg-slate-100 text-slate-700",
  "Scheduled": "bg-[#fae008] text-[#92400E]",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-red-100 text-red-700"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-700",
  "Gate": "bg-green-100 text-green-700",
  "Roller Shutter": "bg-purple-100 text-purple-700",
  "Multiple": "bg-orange-100 text-orange-700",
  "Custom Garage Door": "bg-pink-100 text-pink-700"
};

export default function JobModalView({ job }) {
  const { data: jobType } = useQuery({
    queryKey: ['jobType', job.job_type_id],
    queryFn: () => base44.entities.JobType.get(job.job_type_id),
    enabled: !!job.job_type_id
  });

  const handleCall = () => {
    if (job.customer_phone) {
      window.location.href = `tel:${job.customer_phone}`;
    }
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}&travelmode=driving`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {(job.job_type_name || job.job_type) && (
              <JobTypeBadge 
                value={job.job_type_name || job.job_type} 
                color={jobType?.color}
              />
            )}
            {job.product && (
              <ProductTypeBadge value={job.product} />
            )}
          </div>
          {job.status && (
            <JobStatusBadge value={job.status} />
          )}
        </div>

        <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
          {job.customer_name}
        </h3>

        {/* Schedule Info */}
        {job.scheduled_date && (
          <div className="flex items-center gap-4 text-[14px] text-[#4B5563] flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#6B7280]" />
              <span>{format(parseISO(job.scheduled_date), 'MMM d, yyyy')}</span>
            </div>
            {job.scheduled_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>{job.scheduled_time}</span>
              </div>
            )}
            {job.assigned_to && job.assigned_to.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6B7280] font-medium">Assigned to:</span>
                <TechnicianAvatarGroup
                  technicians={job.assigned_to.map((email, idx) => ({
                    email,
                    full_name: job.assigned_to_name?.[idx] || email,
                    id: email
                  }))}
                  maxDisplay={3}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Address */}
      <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
        <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
          <div className="text-[14px] text-[#111827]">{job.address}</div>
        </div>
      </div>

      {/* Contact */}
      {job.customer_phone && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Phone className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Phone</div>
            <div className="text-[14px] text-[#111827]">{job.customer_phone}</div>
          </div>
        </div>
      )}



      {/* Project Link */}
      {job.project_name && (
        <div className="p-3 bg-[#FAE008]/10 rounded-lg border border-[#FAE008]/30">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Part of Project</div>
          <div className="text-[14px] font-semibold text-[#111827]">{job.project_name}</div>
        </div>
      )}

      {/* Notes Preview */}
      {job.notes && job.notes !== "<p><br></p>" && (
        <div className="p-3 bg-[#FAE008]/10 rounded-lg">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Notes</div>
          <div 
            className="text-[14px] text-[#4B5563] line-clamp-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: job.notes }}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2">
        {job.customer_phone && (
          <Button
            onClick={handleCall}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Phone className="w-4 h-4" />
            Call
          </Button>
        )}
        <Button
          onClick={handleNavigate}
          variant="outline"
          className="flex-1 gap-2"
        >
          <Navigation className="w-4 h-4" />
          Navigate
        </Button>
      </div>
    </div>
  );
}