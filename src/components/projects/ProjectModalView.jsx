import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Briefcase } from "lucide-react";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { ProjectStatusBadge, ProjectTypeBadge } from "../common/StatusBadge";
import { getProjectFreshnessBadge } from "../utils/freshness";

export default function ProjectModalView({ project, jobCount = 0 }) {
  const handleCall = () => {
    if (project.customer_phone) {
      window.location.href = `tel:${project.customer_phone}`;
    }
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`, '_blank');
  };

  const freshness = getProjectFreshnessBadge(project.last_activity_at || project.created_date);
  
  const freshnessColors = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700"
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={freshnessColors[freshness.color]}>
            {freshness.label}
          </Badge>
          <span className="text-[12px] text-[#6B7280]">Age: {freshness.days !== null ? `${freshness.days} days` : 'Unknown'}</span>
          {project.status && (
            <ProjectStatusBadge value={project.status} />
          )}
          {project.project_type && (
            <ProjectTypeBadge value={project.project_type} />
          )}
        </div>

        <div className="text-[16px] font-medium text-[#4B5563]">
          {project.customer_name}
        </div>
      </div>

      {/* Address */}
      <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
        <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
          <div className="text-[14px] text-[#111827]">{project.address}</div>
        </div>
      </div>

      {/* Contact */}
      {project.customer_phone && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Phone className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Phone</div>
            <div className="text-[14px] text-[#111827]">{project.customer_phone}</div>
          </div>
        </div>
      )}

      {/* Job Count */}
      <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg">
        <Briefcase className="w-5 h-5 text-[#6B7280]" />
        <div>
          <div className="text-[12px] text-[#6B7280] font-medium">Jobs</div>
          <div className="text-[14px] font-semibold text-[#111827]">{jobCount} visit{jobCount !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Quote Value */}
      {project.quote_value && (
        <div className="p-3 bg-[#FAE008]/10 rounded-lg border border-[#FAE008]/30">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Quote Value</div>
          <div className="text-[18px] font-bold text-[#111827]">
            ${project.quote_value.toLocaleString()}
          </div>
        </div>
      )}

      {/* Assigned Technicians */}
      {project.assigned_technicians && project.assigned_technicians.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg">
          <span className="text-[12px] text-[#6B7280] font-medium">Team:</span>
          <TechnicianAvatarGroup
            technicians={project.assigned_technicians.map((email, idx) => ({
              email,
              full_name: project.assigned_technicians_names?.[idx] || email,
              id: email
            }))}
            maxDisplay={4}
            size="sm"
          />
        </div>
      )}

      {/* Description Preview */}
      {project.description && project.description !== "<p><br></p>" && (
        <div className="p-3 bg-[#F8F9FA] rounded-lg">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Description</div>
          <div 
            className="text-[14px] text-[#4B5563] line-clamp-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: project.description }}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2">
        {project.customer_phone && (
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
          <MapPin className="w-4 h-4" />
          Navigate
        </Button>
      </div>
    </div>
  );
}