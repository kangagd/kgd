import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";

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



export default function JobCard({ job, onClick, onViewDetails }) {
  const { data: latestVisit } = useQuery({
    queryKey: ['latestJobSummary', job.id],
    queryFn: () => base44.entities.JobSummary.filter({ job_id: job.id }, '-check_out_time', 1).then(res => res[0] || null),
    enabled: !!job.id
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(job);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title and Customer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                  {job.customer_name}
                </h3>
                {job.project_name && (
                  <Badge className="bg-[#FAE008]/20 text-[#92400E] border-0 font-medium px-2.5 py-0.5 rounded-lg pointer-events-none">
                    {job.project_name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white text-[#6B7280] border border-[#E5E7EB] font-medium px-2.5 py-0.5 rounded-lg pointer-events-none">
                  #{job.job_number}
                </Badge>
                {job.status && (
                  <Badge className={`${statusColors[job.status] || 'bg-slate-100 text-slate-700'} font-medium px-2.5 py-0.5 rounded-lg border-0 pointer-events-none`}>
                    {job.status}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="text-[14px] text-[#4B5563] leading-[1.4]">{job.address}</span>
            </div>
          </div>

          {/* Schedule and Type */}
          <div className="flex items-center gap-4 text-[14px] text-[#4B5563]">
            {job.scheduled_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#6B7280]" />
                <span>{format(parseISO(job.scheduled_date), 'MMM d, yyyy')}</span>
              </div>
            )}
            {job.scheduled_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <span>{job.scheduled_time}</span>
              </div>
            )}
          </div>

          {/* Type badges and Technicians */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {job.job_type_name && (
                <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-xs px-2.5 py-0.5 rounded-lg pointer-events-none">
                  {job.job_type_name}
                </Badge>
              )}
              {job.product && (
                <Badge className={`${productColors[job.product]} font-medium text-xs px-2.5 py-0.5 rounded-lg border-0 pointer-events-none`}>
                  {job.product}
                </Badge>
              )}
            </div>
            
            {/* Assigned Technicians */}
            {job.assigned_to && job.assigned_to.length > 0 && (
              <TechnicianAvatarGroup
                technicians={job.assigned_to.map((email, idx) => ({
                  email,
                  full_name: job.assigned_to_name?.[idx] || email,
                  id: email
                }))}
                maxDisplay={3}
                size="sm"
              />
            )}
          </div>

          {/* Latest visit summary (collapsible) */}
          {latestVisit && (
            <Collapsible onClick={(e) => e.stopPropagation()}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]">
                <span>Latest Visit Summary</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span>{latestVisit.technician_name}</span>
                    {latestVisit.check_out_time && (
                      <span>{format(new Date(latestVisit.check_out_time), 'MMM d, h:mm a')}</span>
                    )}
                  </div>
                  {latestVisit.overview && (
                    <div 
                      className="text-[#4B5563] prose prose-sm max-w-none line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: latestVisit.overview }}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}