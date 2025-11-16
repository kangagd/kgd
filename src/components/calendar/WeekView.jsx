import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

const jobTypeColors = [
  "bg-blue-500", "bg-green-500", "bg-orange-500", 
  "bg-purple-500", "bg-indigo-500", "bg-amber-500",
  "bg-red-500", "bg-cyan-500", "bg-teal-500", 
  "bg-pink-500", "bg-rose-500", "bg-lime-500",
];

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
};

export default function WeekView({ jobs, currentDate, onJobClick }) {
  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  const getJobsForDay = (day) => {
    return jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), day)
    ).sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card 
              key={day.toISOString()}
              className={`${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
            >
              <CardContent className="p-3">
                <div className={`text-center mb-3 pb-2 border-b ${isToday ? 'border-blue-200' : 'border-slate-200'}`}>
                  <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>

                <div className="space-y-2">
                  {dayJobs.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">No jobs</div>
                  ) : (
                    dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={`text-xs p-2 rounded cursor-pointer hover:opacity-80 transition-opacity ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} text-white`}
                      >
                        <div className="font-medium mb-1">
                          {job.scheduled_time?.slice(0, 5) || 'No time'}
                        </div>
                        <div className="truncate">{job.customer_name}</div>
                        {job.job_type_name && (
                          <div className="text-xs opacity-90 mt-1 truncate">
                            {job.job_type_name}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
        <span className="font-semibold text-slate-700">Job Types:</span>
        {uniqueJobTypes.map((jobType) => (
          <div key={jobType} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
            <span className="text-slate-600">{jobType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}