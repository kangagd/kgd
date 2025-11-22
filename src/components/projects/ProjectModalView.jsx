import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Briefcase } from "lucide-react";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";

const statusColors = {
  "Lead": "bg-slate-100 text-slate-700",
  "Initial Site Visit": "bg-blue-100 text-blue-700",
  "Quote Sent": "bg-purple-100 text-purple-700",
  "Quote Approved": "bg-indigo-100 text-indigo-700",
  "Final Measure": "bg-cyan-100 text-cyan-700",
  "Parts Ordered": "bg-amber-100 text-amber-700",
  "Scheduled": "bg-[#fae008]/20 text-[#92400E]",
  "Completed": "bg-emerald-100 text-emerald-700"
};

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Multiple": "bg-pink-100 text-pink-700",
  "Motor/Accessory": "bg-cyan-100 text-cyan-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

export default function ProjectModalView({ project, jobCount = 0 }) {
  const handleCall = () => {
    if (project.customer_phone) {
      window.location.href = `tel:${project.customer_phone}`;
    }
  };

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {project.status && (
            <Badge className={`${statusColors[project.status]} font-medium px-2.5 py-0.5 rounded-lg border-0`}>
              {project.status}
            </Badge>
          )}
          {project.project_type && (
            <Badge className={`${projectTypeColors[project.project_type]} font-medium px-2.5 py-0.5 rounded-lg border-0`}>
              {project.project_type}
            </Badge>
          )}
        </div>

        <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
          {project.title}
        </h3>

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