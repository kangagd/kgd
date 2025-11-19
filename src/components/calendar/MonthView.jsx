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

const jobTypeColorsBg = [
  "bg-blue-50", "bg-green-50", "bg-orange-50", 
  "bg-purple-50", "bg-indigo-50", "bg-amber-50",
  "bg-red-50", "bg-cyan-50", "bg-teal-50", 
  "bg-pink-50", "bg-rose-50", "bg-lime-50",
];

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
};

const getJobTypeBgColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-50";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColorsBg[index % jobTypeColorsBg.length];
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-[#FAE008]", "bg-purple-500", "bg-green-500", "bg-orange-500",
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
      <Card className="card-enhanced">
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs md:text-sm font-bold text-[#111827] py-2 uppercase tracking-wide">
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
                  className={`aspect-square border-2 rounded-xl p-1 md:p-2 hover:bg-[#FFFEF0] transition-all ${
                    isToday ? 'bg-[#FAE008]/20 border-[#FAE008] shadow-md' : 'border-[#E5E7EB]'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`text-sm md:text-base font-bold ${
                      isToday ? 'text-[#111827]' : 'text-[#111827]'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {isSameMonth(day, currentDate) && (
                      <button
                        onClick={() => onQuickBook(day)}
                        className="p-1 hover:bg-[#FAE008] hover:text-black rounded-lg transition-all"
                        title="Book job"
                      >
                        <Plus className="w-3 h-3 text-[#4B5563]" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '90px' }}>
                    {dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className="text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:shadow-md transition-all bg-white border-2 border-[#E5E7EB] hover:border-[#FAE008]"
                        title={`${job.customer_name} - ${job.job_type_name || 'No type'} - ${job.scheduled_time || 'No time'}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          {job.scheduled_time && (
                            <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-[#FAE008] text-black">
                              {job.scheduled_time.slice(0, 5)}
                            </span>
                          )}
                          {(job.assigned_to_name && job.assigned_to_name.length > 0) && (
                            <div className="flex -space-x-1">
                              {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 2).map((name, idx) => (
                                <div
                                  key={idx}
                                  className={`${getAvatarColor(name)} w-4 h-4 rounded-full flex items-center justify-center text-black text-[8px] font-bold border-2 border-white`}
                                  title={name}
                                >
                                  {getInitials(name)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="truncate text-[10px] md:text-xs font-semibold text-[#111827]">
                          {job.customer_name}
                        </div>
                        {job.job_type_name && (
                          <div className="truncate text-[9px] text-[#4B5563] mt-0.5">
                            {job.job_type_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {dayJobs.length > 2 && (
                    <div className="text-[9px] font-semibold text-[#4B5563] mt-1 text-center">
                      +{dayJobs.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="card-enhanced">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 text-xs items-center">
            <span className="font-bold text-[#111827] uppercase tracking-wide">Time:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#FAE008] border-2 border-black" />
              <span className="text-[#4B5563] font-medium">Job Time</span>
            </div>
            <span className="mx-2 text-[#E5E7EB]">|</span>
            <span className="font-bold text-[#111827] uppercase tracking-wide">Status:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg border-2 border-[#FAE008]" />
              <span className="text-[#4B5563] font-medium">Scheduled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}