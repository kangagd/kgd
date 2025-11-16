import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, getDay } from "date-fns";
import { Clock, MapPin, User, FileText, Plus, CheckCircle2 } from "lucide-react";

const jobTypeColors = [
  "bg-blue-500", "bg-green-500", "bg-orange-500", 
  "bg-purple-500", "bg-indigo-500", "bg-amber-500",
  "bg-red-500", "bg-cyan-500", "bg-teal-500", 
  "bg-pink-500", "bg-rose-500", "bg-lime-500",
];

const statusColors = {
  open: "bg-slate-400",
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
};

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
};

const getInitials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600",
  "bg-pink-600", "bg-indigo-600", "bg-red-600", "bg-teal-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function WeekView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const weekStart = startOfWeek(currentDate);
  
  const hasWeekendJobs = jobs.some(job => {
    if (!job.scheduled_date) return false;
    const jobDate = new Date(job.scheduled_date);
    const dayOfWeek = getDay(jobDate);
    return dayOfWeek === 0 || dayOfWeek === 6;
  });
  
  const daysToShow = hasWeekendJobs ? 7 : 5;
  const weekDays = Array.from({ length: daysToShow }, (_, i) => {
    if (hasWeekendJobs) {
      return addDays(weekStart, i);
    } else {
      return addDays(weekStart, i + 1);
    }
  });
  
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
      <div className={`grid grid-cols-1 md:grid-cols-${daysToShow} gap-3`} style={{ gridTemplateColumns: `repeat(${daysToShow}, minmax(0, 1fr))` }}>
        {weekDays.map(day => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card 
              key={day.toISOString()}
              className={`${isToday ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
            >
              <CardContent className="p-3">
                <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isToday ? 'border-blue-200' : 'border-slate-200'}`}>
                  <div>
                    <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  <button
                    onClick={() => onQuickBook(day)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Book job"
                  >
                    <Plus className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {dayJobs.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">No jobs scheduled</div>
                  ) : (
                    dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={`p-2.5 rounded-lg cursor-pointer hover:shadow-md transition-all border-l-4 bg-white`}
                        style={{ borderLeftColor: statusColors[job.status] || '#94a3b8' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-900">
                              {job.scheduled_time?.slice(0, 5) || 'No time'}
                            </span>
                            {job.expected_duration && (
                              <span className="text-xs text-slate-500">({job.expected_duration}h)</span>
                            )}
                          </div>
                          {job.status === 'completed' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          )}
                        </div>

                        <div className="font-semibold text-sm text-slate-900 mb-1 truncate">
                          {job.customer_name}
                        </div>

                        <div className="flex items-start gap-1 text-xs text-slate-600 mb-2">
                          <MapPin className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{job.address}</span>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {job.product && (
                            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300">
                              {job.product}
                            </Badge>
                          )}
                          {job.job_type_name && (
                            <Badge className={`text-xs text-white ${getJobTypeColor(job.job_type_name, uniqueJobTypes)}`}>
                              {job.job_type_name}
                            </Badge>
                          )}
                        </div>

                        {(job.assigned_to_name && job.assigned_to_name.length > 0) && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                            <User className="w-3 h-3 text-slate-400" />
                            <div className="flex -space-x-1.5">
                              {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 2).map((name, idx) => (
                                <div
                                  key={idx}
                                  className={`${getAvatarColor(name)} w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white shadow-sm`}
                                  title={name}
                                >
                                  {getInitials(name)}
                                </div>
                              ))}
                              {Array.isArray(job.assigned_to_name) && job.assigned_to_name.length > 2 && (
                                <div className="bg-slate-300 w-5 h-5 rounded-full flex items-center justify-center text-slate-700 text-[9px] font-bold border-2 border-white shadow-sm">
                                  +{job.assigned_to_name.length - 2}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 truncate flex-1">
                              {Array.isArray(job.assigned_to_name) ? job.assigned_to_name[0] : job.assigned_to_name}
                            </span>
                          </div>
                        )}

                        {job.outcome && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                            <FileText className="w-3 h-3 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-700">
                              {job.outcome.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}

                        {job.notes && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-start gap-1">
                              <FileText className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-slate-600 line-clamp-2">{job.notes.replace(/<[^>]*>/g, '')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {dayJobs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-center">
                    <span className="text-xs font-medium text-slate-600">
                      {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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