import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, User, UserX } from "lucide-react";
import {   
  ProjectStatusBadge, 
  ProjectTypeBadge, 
  CustomerTypeBadge, 
  OrganisationTypeBadge 
} from "@/components/common/StatusBadge";
import EntityLink from "@/components/common/EntityLink";
import { DuplicateBadge } from "@/components/common/DuplicateWarningCard";
import { createPageUrl } from "@/utils";

const ProjectCard = React.memo(({
  project,
  jobCount,
  nextJob,
  suburb,
  freshness,
  age,
  hasCustomerIssue,
  hasShortage,
  hasRequiredTrades,
  onViewDetails,
  displayTitle,
  customerLabel
}) => {

  const freshnessColors = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700"
  };

  return (
    <EntityLink
      to={`${createPageUrl("Projects")}?projectId=${project.id}`}
      className="block"
    >
      <Card className="hover:shadow-lg transition-all duration-200 hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <Badge variant="secondary" className="pointer-events-none">
            #{project.project_number}
          </Badge>
          <Badge className={freshnessColors[freshness.color]}>
            {freshness.label}
          </Badge>
          {age !== null && (
            <span className="text-[12px] text-[#6B7280] bg-white px-2 py-0.5 rounded-lg border border-[#E5E7EB]">
              {age}d
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-[#F3F4F6]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewDetails(project);
            }}
          >
            <Eye className="w-4 h-4 text-[#6B7280]" />
          </Button>
        </div>
        <CardContent className="p-4">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2 pr-40">
              <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">{displayTitle}</h3>
              <DuplicateBadge record={project} size="sm" />
              {hasCustomerIssue && (
                <span className="inline-flex items-center gap-1" title="Customer information missing">
                  <UserX className="w-4 h-4 text-[#DC2626]" />
                </span>
              )}
              {hasShortage && (
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                  Shortage
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {project.organisation_type && <OrganisationTypeBadge value={project.organisation_type} />}
              {project.customer_type && <CustomerTypeBadge value={project.customer_type} />}
              {project.project_type && <ProjectTypeBadge value={project.project_type} />}
              <ProjectStatusBadge value={project.status} />
              {hasRequiredTrades && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 font-medium">
                  Third-party required
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-3 text-[#4B5563] flex-wrap">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span className="text-[14px] leading-[1.4]">{customerLabel}</span>
            </div>
            {suburb && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[14px] leading-[1.4]">{suburb}</span>
              </div>
            )}
          </div>
          {project.stage && (
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="font-medium text-[12px] leading-[1.35] border-[#E5E7EB]">
                {project.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>
          )}
          <div className="flex items-center justify-between text-[14px] leading-[1.4] pt-3 border-t border-[#E5E7EB]">
            <span className="text-[#4B5563] font-medium">
              Jobs: <span className="text-[#111827] font-semibold">{jobCount}</span>
            </span>
            {nextJob && (
              <div className="text-[#4B5563]">
                <span className="font-medium">Next: </span>
                <span className="text-[#111827] font-medium">
                  {new Date(nextJob.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  {nextJob.scheduled_time && ` · ${nextJob.scheduled_time}`}
                  {nextJob.job_type_name && ` · ${nextJob.job_type_name}`}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </EntityLink>
  );
});

export default ProjectCard;