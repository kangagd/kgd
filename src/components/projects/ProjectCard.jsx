import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, Building2, UserCircle } from "lucide-react";
import { ProjectStatusBadge, ProjectTypeBadge } from "../common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { DuplicateBadge } from "../common/DuplicateWarningCard";

export default function ProjectCard({ project, onClick, onViewDetails }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  const handlePreview = (e) => {
    e.stopPropagation();
    if (onViewDetails) onViewDetails(project);
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative group"
      onClick={handleClick}
    >
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-[#F3F4F6]"
          onClick={handlePreview}
        >
          <Eye className="w-4 h-4 text-[#6B7280]" />
        </Button>
      </div>

      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header: Name + Badges */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] line-clamp-1" title={project.title}>
                {project.title}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ProjectStatusBadge value={project.status} className="pointer-events-none" />
                <DuplicateBadge record={project} size="sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ProjectTypeBadge value={project.project_type} className="pointer-events-none" />
              {project.contract_id && (
                 <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] px-2 py-0.5">
                   Contract
                 </Badge>
              )}
            </div>
          </div>

          {/* Customer & Org */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
              <UserCircle className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="truncate font-medium text-[#111827]">{project.customer_name || "Unknown Customer"}</span>
            </div>
            {project.organisation_name && (
              <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
                <Building2 className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <span className="truncate">{project.organisation_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
              <MapPin className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="truncate">{project.address || project.site_address || "No address"}</span>
            </div>
          </div>

          {/* Footer: Job Count */}
          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[13px] text-[#6B7280]">
              <Briefcase className="w-4 h-4" />
              <span className="font-medium text-[#111827]">{project.jobs?.length || 0}</span>
              <span>Jobs</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}