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
  const [user, setUser] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const compactMode = true;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  
  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  const getJobsForDay = (day) => {
    const dayJobs = jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), day)
    );
    
    if (isTechnician) {
      return dayJobs.filter(job => {
        const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : [];
        return assignedTo.includes(user.email);
      });
    }
    
    return dayJobs;
  };

  const extractSuburb = (address) => {
    if (!address) return '';
    const parts = address.split(',').map(s => s.trim());
    return parts[parts.length - 2] || parts[parts.length - 1] || '';
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
              const isSelected = selectedDay && isSameDay(selectedDay, day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    if (isTechnician && dayJobs.length > 0) {
                      setSelectedDay(isSelected ? null : day);
                    }
                  }}
                  className={`aspect-square border rounded-lg ${compactMode ? 'p-1' : 'p-1 md:p-2'} transition-colors ${
                    isSelected ? 'bg-[#FAE008]/20 border-[#FAE008] ring-2 ring-[#FAE008]' :
                    isToday ? 'bg-[#FAE008]/10 border-[#FAE008]' : 
                    'border-[#E5E7EB] hover:bg-[#F8F9FA]/50'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''} ${
                    isTechnician && dayJobs.length > 0 ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-0.5">
                    <div className={`${compactMode ? 'text-[10px]' : 'text-xs md:text-sm'} font-bold ${
                      isToday ? 'text-[#111827] bg-[#FAE008] px-1 py-0.5 rounded' : 'text-[#111827]'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {isSameMonth(day, currentDate) && !compactMode && !isTechnician && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickBook(day);
                        }}
                        className="p-0.5 hover:bg-[#F3F4F6] rounded transition-colors"
                        title="Book job"
                      >
                        <Plus className="w-3 h-3 text-[#6B7280]" />
                      </button>
                    )}
                  </div>
                  
                  {/* Mobile technician: just show count */}
                  {isTechnician && dayJobs.length > 0 ? (
                    <div className="lg:hidden flex items-center justify-center h-full">
                      <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] border-0 font-bold text-xs px-2 py-1 rounded-lg">
                        {dayJobs.length}
                      </Badge>
                    </div>
                  ) : (
                    <div className={`space-y-0.5 overflow-y-auto ${compactMode ? 'max-h-[60px]' : ''}`} style={{ maxHeight: compactMode ? '60px' : '90px' }}>
                      {dayJobs.slice(0, compactMode ? 2 : 3).map(job => {
                        const isPriority = job.priority === 'high' || job.outcome === 'return_visit_required';
                        
                        return (
                          <div
                            key={job.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onJobClick(job);
                            }}
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
                                <Badge className={`${getJobTypeBgColor(job.job_type_name, uniqueJobTypes)} ${getJobTypeColor(job.job_type_name, uniqueJobTypes).replace('bg-', 'text-')} hover:${getJobTypeBgColor(job.job_type_name, uniqueJobTypes)} border-0 font-semibold text-[8px] px-1.5 py-0 rounded truncate w-full justify-start`}>
                                  {job.job_type_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {dayJobs.length > (compactMode ? 2 : 3) && !isTechnician && (
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

      {/* Mobile technician: Show selected day's jobs */}
      {isTechnician && selectedDay && (
        <div className="lg:hidden space-y-2">
          <div className="flex items-center justify-between p-3 bg-[#FAE008]/10 rounded-lg border border-[#FAE008]">
            <h3 className="text-sm font-bold text-[#111827]">
              {format(selectedDay, 'EEEE, MMM d')}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedDay(null)}
              className="h-8 w-8 p-0"
            >
              ✕
            </Button>
          </div>

          {getJobsForDay(selectedDay).map(job => {
            const isPriority = job.priority === 'high' || job.outcome === 'return_visit_required';
            const suburb = extractSuburb(job.address);

            return (
              <Card 
                key={job.id} 
                className="border border-[#E5E7EB] shadow-sm hover:border-[#FAE008] transition-all cursor-pointer"
                onClick={() => onJobClick(job)}
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] border-0 font-bold text-xs px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {job.scheduled_time?.slice(0, 5) || 'TBD'}
                      </Badge>
                      {isPriority && (
                        <Badge className="bg-[#FED7AA] text-[#9A3412] hover:bg-[#FED7AA] border-0 font-semibold text-xs px-2 py-1 rounded-lg">
                          <AlertTriangle className="w-3 h-3" />
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#111827] leading-tight mb-0.5">
                        {job.customer_name}
                      </h4>
                      <p className="text-xs text-[#6B7280] font-medium">{suburb}</p>
                    </div>

                    {job.job_type_name && (
                      <Badge className={`${getJobTypeBgColor(job.job_type_name, uniqueJobTypes)} ${getJobTypeColor(job.job_type_name, uniqueJobTypes).replace('bg-', 'text-')} hover:${getJobTypeBgColor(job.job_type_name, uniqueJobTypes)} border-0 font-semibold text-xs px-2 py-0.5 rounded-lg`}>
                        {job.job_type_name}
                      </Badge>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-[#E5E7EB]">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-2 font-semibold min-h-[44px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (job.customer_phone) window.location.href = `tel:${job.customer_phone}`;
                        }}
                      >
                        📞 Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-2 font-semibold min-h-[44px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank');
                        }}
                      >
                        🧭 Navigate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}