import React from "react";
import { Card } from "@/components/ui/card";
import { format, parseISO, isSameDay } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Clock, Grip, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

const hours = Array.from({ length: 24 }, (_, i) => i);

export default function DayCalendar({ currentDate, jobs, onJobClick, isLoading }) {
  const getJobsForDay = () => {
    return jobs.filter(job => {
      try {
        return job.scheduled_date && isSameDay(parseISO(job.scheduled_date), currentDate);
      } catch {
        return false;
      }
    }).sort((a, b) => {
      const timeA = a.scheduled_time || "00:00";
      const timeB = b.scheduled_time || "00:00";
      return timeA.localeCompare(timeB);
    });
  };

  const getJobsForHour = (hour) => {
    const dayJobs = getJobsForDay();
    return dayJobs.filter(job => {
      if (!job.scheduled_time) return hour === 0;
      const jobHour = parseInt(job.scheduled_time.split(':')[0]);
      return jobHour === hour;
    });
  };

  const unscheduledJobs = getJobsForDay().filter(job => !job.scheduled_time);

  return (
    <div className="space-y-4">
      {unscheduledJobs.length > 0 && (
        <Card className="border-none shadow-sm p-4 bg-amber-50 border-l-4 border-amber-500">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Unscheduled ({unscheduledJobs.length})
          </h3>
          <div className="grid gap-2">
            {unscheduledJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onJobClick(job)}
                className="p-3 rounded-lg bg-white border border-amber-200 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{job.customer_name}</div>
                    <div className="text-sm text-slate-600 mt-1">{job.address}</div>
                    {job.job_type_name && (
                      <Badge variant="outline" className="text-xs mt-2">
                        {job.job_type_name}
                      </Badge>
                    )}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: statusColors[job.status]?.replace('bg-', '#') || '#94a3b8' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-200">
          {hours.map((hour) => {
            const hourJobs = getJobsForHour(hour);
            const displayTime = format(new Date().setHours(hour, 0, 0, 0), 'h:mm a');

            return (
              <div key={hour} className="flex">
                <div className="w-24 flex-shrink-0 p-4 bg-slate-50 border-r border-slate-200">
                  <div className="text-sm font-medium text-slate-700">{displayTime}</div>
                </div>
                <div className="flex-1 p-3 min-h-[80px]">
                  {hourJobs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-300 text-sm">
                      No jobs
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hourJobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => onJobClick(job)}
                          className="p-3 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                          style={{
                            borderLeftWidth: '4px',
                            borderLeftColor: statusColors[job.status]?.replace('bg-', '#') || '#94a3b8'
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900">{job.customer_name}</div>
                              <div className="text-sm text-slate-600 mt-1">{job.address}</div>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-slate-500 flex-shrink-0 ml-3">
                              <Clock className="w-4 h-4" />
                              {job.scheduled_time}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.job_type_name && (
                              <Badge variant="outline" className="text-xs">
                                {job.job_type_name}
                              </Badge>
                            )}
                            {job.assigned_to_name && Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <User className="w-3 h-3" />
                                {job.assigned_to_name.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}