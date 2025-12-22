import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Calendar, CheckSquare, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TechnicianAvatarGroup } from "../common/TechnicianAvatar";
import { AddIconButton } from "@/components/ui/AddIconButton";
import TasksPanel from "../tasks/TasksPanel";

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-700",
  "Scheduled": "bg-blue-100 text-blue-700",
  "Completed": "bg-emerald-100 text-emerald-700",
  "Cancelled": "bg-red-100 text-red-700"
};

export default function ProjectNextActionsZone({ 
  project, 
  jobs = [], 
  onAddJob, 
  onJobClick, 
  onPreviewJob,
  canCreateJobs 
}) {
  const [open, setOpen] = React.useState(true);

  // Filter to upcoming/open jobs only
  const upcomingJobs = jobs
    .filter(j => j.status !== "Completed" && j.status !== "Cancelled")
    .sort((a, b) => {
      // Sort by scheduled date, then by created date
      const dateA = a.scheduled_date || a.created_date || '';
      const dateB = b.scheduled_date || b.created_date || '';
      return dateA.localeCompare(dateB);
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">What's Next</h3>
              {upcomingJobs.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {upcomingJobs.length} upcoming
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? 'transform rotate-180' : ''}`} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            {/* Upcoming Visits */}
            {upcomingJobs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide">
                    Upcoming Visits
                  </div>
                  {canCreateJobs && (
                    <AddIconButton
                      onClick={onAddJob}
                      title="Add Visit"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  {upcomingJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-[#FAE008] hover:shadow-sm transition-all cursor-pointer relative group"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewJob(job);
                        }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-md hover:bg-[#F3F4F6] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4 text-[#6B7280]" />
                      </button>
                      <div 
                        className="flex flex-col gap-2"
                        onClick={() => onJobClick(job.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap pr-8">
                          {job.job_type_name && (
                            <span className="text-[14px] font-semibold text-[#111827]">
                              {job.job_type_name}
                            </span>
                          )}
                          <Badge className="bg-white text-[#6B7280] border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                            #{job.job_number}
                          </Badge>
                          <Badge className={`${jobStatusColors[job.status]} border-0 font-semibold text-xs px-3 py-1 rounded-lg`}>
                            {job.status}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          {job.scheduled_date ? (
                            <p className="text-sm text-[#4B5563]">
                              {format(parseISO(job.scheduled_date), "EEE d MMM")}
                              {job.scheduled_time && `, ${job.scheduled_time}`}
                              {job.expected_duration && ` (${job.expected_duration}h)`}
                            </p>
                          ) : (
                            <p className="text-sm text-[#9CA3AF] italic">
                              Not scheduled yet
                            </p>
                          )}

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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            <div>
              <div className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                Tasks
              </div>
              <TasksPanel
                entityType="project"
                entityId={project.id}
                entityName={project.title}
                compact={true}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}