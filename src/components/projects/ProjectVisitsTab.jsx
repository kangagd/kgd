import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Clock, User, Calendar, ImageIcon, FileText, ExternalLink, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const statusColors = {
  "Open": "bg-slate-100 text-slate-800 border-slate-200",
  "Scheduled": "bg-blue-100 text-blue-800 border-blue-200",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800",
  update_quote: "bg-indigo-100 text-indigo-800",
  send_invoice: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  return_visit_required: "bg-amber-100 text-amber-800"
};

export default function ProjectVisitsTab({ projectId, isReadOnly }) {
  const navigate = useNavigate();

  // Fetch jobs linked to this project
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['projectJobs', projectId],
    queryFn: () => base44.entities.Job.filter({ project_id: projectId, deleted_at: { $exists: false } }, '-scheduled_date')
  });

  // Fetch visit summaries (check-out records)
  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['projectJobSummaries', projectId],
    queryFn: () => base44.entities.JobSummary.filter({ project_id: projectId }, '-check_out_time')
  });

  const isLoading = jobsLoading || visitsLoading;

  const handleOpenJob = (jobId) => {
    navigate(createPageUrl("Jobs") + `?jobId=${jobId}`);
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[14px] text-[#6B7280]">Loading visits...</p>
      </div>
    );
  }

  if (jobs.length === 0 && visits.length === 0) {
    return (
      <div className="text-center py-12 bg-[#F8F9FA] rounded-lg border border-[#E5E7EB]">
        <p className="text-[14px] text-[#6B7280] mb-2">No visits recorded yet</p>
        <p className="text-[12px] text-[#9CA3AF]">Jobs will appear here once scheduled</p>
      </div>
    );
  }

  // Create a combined list: jobs that don't have visit summaries + visit summaries
  const jobsWithoutSummaries = jobs.filter(job => 
    !visits.some(visit => visit.job_id === job.id)
  );

  return (
    <div className="space-y-3">
      {/* Jobs without visit summaries (scheduled/open jobs) */}
      {jobsWithoutSummaries.map((job) => (
        <Card key={job.id} className="border border-[#E5E7EB] shadow-sm hover:border-[#FAE008] transition-all">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                      #{job.job_number}
                    </Badge>
                    {job.job_type_name && (
                      <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                        {job.job_type_name}
                      </Badge>
                    )}
                    {job.status && (
                      <Badge className={`${statusColors[job.status]} font-semibold text-xs px-3 py-1 rounded-lg border`}>
                        {job.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta Info Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <span className="text-[#111827] font-medium truncate">{job.assigned_to_name.join(', ')}</span>
                  </div>
                )}
                {job.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <span className="text-[#4B5563]">
                      {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                      {job.scheduled_time && ` at ${job.scheduled_time}`}
                    </span>
                  </div>
                )}
                {job.expected_duration && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <span className="text-[#4B5563] font-medium">{job.expected_duration}h expected</span>
                  </div>
                )}
              </div>

              {/* Footer with button */}
              <div className="flex items-center justify-end pt-3 border-t border-[#E5E7EB]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenJob(job.id)}
                  className="gap-2 hover:bg-[#FAE008] hover:text-[#111827] hover:border-[#FAE008] transition-all"
                >
                  Open Job
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Completed visit summaries */}
      {visits.map((visit) => (
        <Card key={visit.id} className="border border-[#E5E7EB] shadow-sm hover:border-[#FAE008] transition-all">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                      #{visit.job_number}
                    </Badge>
                    {visit.job_type && (
                      <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                        {visit.job_type}
                      </Badge>
                    )}
                    {visit.status_at_checkout && (
                      <Badge className={`${statusColors[visit.status_at_checkout]} font-semibold text-xs px-3 py-1 rounded-lg border`}>
                        {visit.status_at_checkout}
                      </Badge>
                    )}
                    {visit.outcome && (
                      <Badge className={`${outcomeColors[visit.outcome]} font-medium text-xs px-2.5 py-0.5 rounded-lg`}>
                        {visit.outcome.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta Info Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[#111827] font-medium truncate">{visit.technician_name}</span>
                </div>
                {visit.scheduled_datetime && !isNaN(new Date(visit.scheduled_datetime).getTime()) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                    <span className="text-[#4B5563]">{format(new Date(visit.scheduled_datetime), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[#4B5563] font-medium">{formatDuration(visit.duration_minutes)}</span>
                </div>
              </div>

              {/* Overview */}
              {visit.overview && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-[#111827] hover:text-[#FAE008] transition-colors group">
                    <span>Overview</span>
                    <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div 
                      className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: visit.overview }}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Next Steps */}
              {visit.next_steps && (
                <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E5E7EB]">
                  <div className="text-xs font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wide">Next Steps</div>
                  <div 
                    className="text-sm text-[#111827] prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: visit.next_steps }}
                  />
                </div>
              )}

              {/* Communication */}
              {visit.communication_with_client && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-[#111827] hover:text-[#FAE008] transition-colors group">
                    <span>Client Communication</span>
                    <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div 
                      className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: visit.communication_with_client }}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Footer with indicators and button */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                  {visit.photo_urls && visit.photo_urls.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      <span>{visit.photo_urls.length} photo{visit.photo_urls.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {visit.measurements && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>Measurements recorded</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenJob(visit.job_id)}
                  className="gap-2 hover:bg-[#FAE008] hover:text-[#111827] hover:border-[#FAE008] transition-all"
                >
                  Open Job
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>

              {/* Checkout timestamp */}
              {visit.check_out_time && !isNaN(new Date(visit.check_out_time).getTime()) && (
                <div className="text-xs text-[#9CA3AF] text-right">
                  Checked out {format(new Date(visit.check_out_time), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}