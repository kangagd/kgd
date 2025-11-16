import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { Plus } from "lucide-react";

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

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function MonthView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);
  
  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  const getJobsForDay = (day) => {
    return jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), day)
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs md:text-sm font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}

            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {daysInMonth.map(day => {
              const dayJobs = getJobsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square border rounded-lg p-1 md:p-2 hover:bg-slate-50 transition-colors ${
                    isToday ? 'bg-blue-50 border-blue-300 border-2' : 'border-slate-200'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`text-xs md:text-sm font-medium ${
                      isToday ? 'text-blue-600' : 'text-slate-700'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {isSameMonth(day, currentDate) && (
                      <button
                        onClick={() => onQuickBook(day)}
                        className="p-0.5 hover:bg-slate-200 rounded transition-colors"
                        title="Book job"
                      >
                        <Plus className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '90px' }}>
                    {dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={`text-xs px-1.5 py-1 rounded cursor-pointer hover:opacity-90 transition-all ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} text-white`}
                        title={`${job.customer_name} - ${job.job_type_name || 'No type'} - ${job.scheduled_time || 'No time'}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          {job.scheduled_time && (
                            <span className="font-semibold text-[10px]">{job.scheduled_time.slice(0, 5)}</span>
                          )}
                          {(job.assigned_to_name && job.assigned_to_name.length > 0) && (
                            <div className="flex -space-x-1">
                              {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 2).map((name, idx) => (
                                <div
                                  key={idx}
                                  className={`${getAvatarColor(name)} w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold border border-white`}
                                  title={name}
                                >
                                  {getInitials(name)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="truncate text-[10px] md:text-xs font-medium">
                          {job.customer_name}
                        </div>
                      </div>
                    ))}
                  </div>
                  {dayJobs.length > 2 && (
                    <div className="text-[9px] text-slate-500 mt-1 text-center">
                      +{dayJobs.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
        <span className="font-semibold text-slate-700">Job Types:</span>
        {uniqueJobTypes.map((jobType) => (
          <div key={jobType} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
            <span className="text-slate-600">{jobType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}