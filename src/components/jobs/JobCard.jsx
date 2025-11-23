import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Clock, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge, JobTypeBadge, ProductTypeBadge } from "../common/StatusBadge";



export default function JobCard({ job, onClick, onViewDetails }) {
  const { data: latestVisit } = useQuery({
    queryKey: ['latestJobSummary', job.id],
    queryFn: () => base44.entities.JobSummary.filter({ job_id: job.id }, '-check_out_time', 1).then(res => res[0] || null),
    enabled: !!job.id
  });

  const [lastClickTime, setLastClickTime] = React.useState(0);

  const handleClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    
    // Double-click: navigate to full page
    if (now - lastClickTime < 300) {
      window.location.href = `/jobs?jobId=${job.id}`;
      return;
    }
    
    // Single click: open modal
    setLastClickTime(now);
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
              <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                {job.customer_name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="pointer-events-none">
                  #{job.job_number}
                </Badge>
                {job.status && (
                  <JobStatusBadge value={job.status} className="pointer-events-none" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="text-[14px] text-[#4B5563] leading-[1.4]">{job.address}</span>
            </div>
          </div>

          {/* Metadata row */}
          {job.project_name && (
            <div className="flex items-center gap-2 flex-wrap text-[14px]">
              <Badge className="bg-[#FAE008]/20 text-[#92400E] border-0 font-medium px-2.5 py-0.5 rounded-lg pointer-events-none">
                {job.project_name}
              </Badge>
            </div>
          )}

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
                <JobTypeBadge value={job.job_type_name} className="pointer-events-none" />
              )}
              {job.product && (
                <ProductTypeBadge value={job.product} className="pointer-events-none" />
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