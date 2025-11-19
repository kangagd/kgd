import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { Plus, Clock, Briefcase, AlertTriangle } from "lucide-react";

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
  "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function MonthView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const compactMode = true;
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
    <div className="space-y-3">
      <Card className="rounded-lg border border-[#E5E7EB] shadow-sm overflow-hidden">
        <CardContent className={compactMode ? 'p-2' : 'p-3 md:p-4'}>
          <div className={`grid grid-cols-7 ${compactMode ? 'gap-1' : 'gap-1 md:gap-2'}`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className={`text-center ${compactMode ? 'text-[10px] py-1.5' : 'text-xs md:text-sm py-2'} font-bold uppercase tracking-wider text-[#6B7280]`}>
                {compactMode ? day.charAt(0) : day}
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
                  className={`aspect-square border rounded-lg ${compactMode ? 'p-1' : 'p-1 md:p-2'} hover:bg-[#F8F9FA]/50 transition-colors ${
                    isToday ? 'bg-[#FAE008]/10 border-[#FAE008]' : 'border-[#E5E7EB]'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start justify-between mb-0.5">
                    <div className={`${compactMode ? 'text-[10px]' : 'text-xs md:text-sm'} font-bold ${
                      isToday ? 'text-[#111827] bg-[#FAE008] px-1 py-0.5 rounded' : 'text-[#111827]'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {isSameMonth(day, currentDate) && !compactMode && (
                      <button
                        onClick={() => onQuickBook(day)}
                        className="p-0.5 hover:bg-[#F3F4F6] rounded transition-colors"
                        title="Book job"
                      >
                        <Plus className="w-3 h-3 text-[#6B7280]" />
                      </button>
                    )}
                  </div>
                  <div className={`space-y-0.5 overflow-y-auto ${compactMode ? 'max-h-[60px]' : ''}`} style={{ maxHeight: compactMode ? '60px' : '90px' }}>
                    {dayJobs.slice(0, compactMode ? 2 : 3).map(job => {
                      const isPriority = job.priority === 'high' || job.outcome === 'return_visit_required';
                      
                      return (
                        <div
                          key={job.id}
                          onClick={() => onJobClick(job)}
                          className={`${compactMode ? 'text-[9px] px-1 py-0.5' : 'text-xs px-1.5 py-1'} rounded cursor-pointer hover:shadow-sm transition-all bg-white border border-[#E5E7EB] hover:border-[#FAE008]`}
                          title={`${job.customer_name} - ${job.job_type_name || 'No type'} - ${job.scheduled_time || 'No time'}`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-semibold text-[#111827] leading-tight truncate">
                              {job.customer_name}
                            </div>
                            
                            <div className="flex items-center gap-0.5 flex-wrap">
                              <Badge className="bg-[#F2F4F7] text-[#344054] hover:bg-[#F2F4F7] border-0 font-medium text-[8px] px-1 py-0 rounded">
                                #{job.job_number}
                              </Badge>
                              {isPriority && (
                                <Badge className="bg-[#FED7AA] text-[#9A3412] hover:bg-[#FED7AA] border-0 font-semibold text-[8px] px-1 py-0 rounded">
                                  <AlertTriangle className="w-2 h-2" />
                                </Badge>
                              )}
                              {job.scheduled_time && (
                                <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] border-0 font-semibold text-[8px] px-1 py-0 rounded">
                                  <Clock className="w-2 h-2 mr-0.5" />
                                  {job.scheduled_time.slice(0, 5)}
                                </Badge>
                              )}
                            </div>
                            
                            {job.job_type_name && (
                              <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-[8px] px-1.5 py-0 rounded truncate w-full justify-start">
                                {job.job_type_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dayJobs.length > (compactMode ? 2 : 3) && (
                    <div className={`${compactMode ? 'text-[8px]' : 'text-[9px]'} text-[#6B7280] mt-0.5 text-center font-semibold`}>
                      +{dayJobs.length - (compactMode ? 2 : 3)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {uniqueJobTypes.length > 0 && (
        <div className="flex flex-wrap gap-2.5 text-xs bg-white p-3.5 rounded-lg border border-[#E5E7EB] shadow-sm">
          <span className="font-bold text-[#111827] text-[10px] uppercase tracking-wider">Legend:</span>
          {uniqueJobTypes.map((jobType) => (
            <div key={jobType} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
              <span className="text-[#4B5563] font-medium text-[11px]">{jobType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}