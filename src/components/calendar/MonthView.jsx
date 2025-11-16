import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";

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

export default function MonthView({ jobs, currentDate, onJobClick }) {
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
                  className={`aspect-square border rounded-lg p-1 md:p-2 ${
                    isToday ? 'bg-blue-50 border-blue-300' : 'border-slate-200'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
                >
                  <div className={`text-xs md:text-sm font-medium mb-1 ${
                    isToday ? 'text-blue-600' : 'text-slate-700'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '80px' }}>
                    {dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={`text-xs px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} text-white truncate`}
                        title={`${job.customer_name} - ${job.job_type_name || 'No type'} - ${job.scheduled_time || 'No time'}`}
                      >
                        {job.scheduled_time && (
                          <span className="font-medium">{job.scheduled_time.slice(0, 5)} </span>
                        )}
                        <span className="hidden md:inline">{job.customer_name}</span>
                        <span className="md:hidden">#{job.job_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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