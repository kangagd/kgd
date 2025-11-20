import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { MapPin, AlertCircle, Clock, Briefcase, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import JobHoverCard from "./JobHoverCard";

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

const statusColors = {
  open: "bg-[#F3F4F6]",
  scheduled: "bg-[#FAE008]",
  in_progress: "bg-[#D97706]",
  completed: "bg-[#16A34A]",
};

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
  "bg-pink-600", "bg-indigo-600", "bg-red-600", "bg-teal-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function WeekView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const queryClient = useQueryClient();
  const compactMode = true;

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const weekStart = startOfWeek(currentDate);
  const allWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Check if there are jobs on Saturday (day 6) or Sunday (day 0)
  const hasWeekendJobs = jobs.some(job => {
    if (!job.scheduled_date) return false;
    const jobDate = new Date(job.scheduled_date);
    const dayOfWeek = jobDate.getDay();
    return (dayOfWeek === 0 || dayOfWeek === 6) &&
           allWeekDays.some(d => isSameDay(d, jobDate));
  });

  // Show Mon-Fri (indices 1-5) unless there are weekend jobs
  const weekDays = hasWeekendJobs ? allWeekDays : allWeekDays.slice(1, 6);

  const assignedTechnicianEmails = [...new Set(jobs.flatMap(job => job.assigned_to || []))];
  const visibleTechnicians = technicians.filter(tech => assignedTechnicianEmails.includes(tech.email));

  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPendingUpdate(null);
    }
  });

  const getJobsForCell = (day, technicianEmail) => {
    return jobs.filter(job =>
      job.scheduled_date &&
      isSameDay(new Date(job.scheduled_date), day) &&
      (job.assigned_to && job.assigned_to.includes(technicianEmail))
    ).sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedJob(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e, day, technicianEmail) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell(`${day.toISOString()}-${technicianEmail}`);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e, day, technicianEmail) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedJob) return;

    const newDate = format(day, 'yyyy-MM-dd');
    const oldDate = draggedJob.scheduled_date;
    const oldAssignedTo = Array.isArray(draggedJob.assigned_to) ? draggedJob.assigned_to : [];
    const newAssignedTo = [technicianEmail];
    const oldAssignedToName = Array.isArray(draggedJob.assigned_to_name) ? draggedJob.assigned_to_name : [];
    const newAssignedToName = [technicians.find(t => t.email === technicianEmail)?.full_name || ''];

    const dateChanged = newDate !== oldDate;
    const technicianChanged = oldAssignedTo[0] !== newAssignedTo[0];

    if (!dateChanged && !technicianChanged) {
      setDraggedJob(null);
      return;
    }

    setPendingUpdate({
      job: draggedJob,
      newDate,
      oldDate,
      newAssignedTo,
      newAssignedToName,
      oldAssignedToName: oldAssignedToName.length > 0 ? oldAssignedToName[0] : 'Unassigned',
      newAssignedToDisplay: newAssignedToName.length > 0 ? newAssignedToName[0] : 'Unassigned',
      dateChanged,
      technicianChanged
    });

    setDraggedJob(null);
  };

  const confirmUpdate = () => {
    if (!pendingUpdate) return;
    updateJobMutation.mutate({
      id: pendingUpdate.job.id,
      data: {
        scheduled_date: pendingUpdate.newDate,
        assigned_to: pendingUpdate.newAssignedTo,
        assigned_to_name: pendingUpdate.newAssignedToName,
      }
    });
  };

  return (
    <>
      <div className="space-y-3">
        <Card className="rounded-lg border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid border-b border-[#E5E7EB] bg-[#F8F9FA] sticky top-0 z-10" style={{ gridTemplateColumns: `${compactMode ? '140px' : '180px'} repeat(${weekDays.length}, 1fr)` }}>
                <div className={`${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] font-bold text-xs text-[#111827] tracking-tight uppercase`}>
                  Technician
                </div>
                {weekDays.map(day => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`text-center ${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] transition-colors ${
                        isToday ? 'bg-[#FAE008]/10' : ''
                      }`}
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isToday ? 'text-[#111827]' : 'text-[#6B7280]'}`}>
                        {format(day, 'EEE').toUpperCase()}
                      </div>
                      <div className={`text-2xl font-bold leading-none ${isToday ? 'text-[#111827]' : 'text-[#4B5563]'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleTechnicians.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280] font-medium text-sm">
                  No technicians assigned to jobs this week.
                </div>
              ) : (
                visibleTechnicians.map(technician => (
                  <div 
                    key={technician.id} 
                    className="grid border-b border-[#E5E7EB] hover:bg-[#F8F9FA]/50 transition-colors" 
                    style={{ 
                      gridTemplateColumns: `${compactMode ? '140px' : '180px'} repeat(${weekDays.length}, 1fr)`, 
                      minHeight: compactMode ? '100px' : '140px' 
                    }}
                  >
                    <div className={`${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] flex items-center gap-2 sticky left-0 bg-white z-10`}>
                      <div className={`${getAvatarColor(technician.full_name)} ${compactMode ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center text-white font-bold ${compactMode ? 'text-xs' : 'text-sm'} shadow-sm flex-shrink-0`}>
                        {getInitials(technician.full_name)}
                      </div>
                      <span className={`${compactMode ? 'text-xs' : 'text-sm'} font-bold text-[#111827] truncate`}>
                        {technician.full_name}
                      </span>
                    </div>

                    {weekDays.map(day => {
                      const jobsInCell = getJobsForCell(day, technician.email);
                      const isDragOver = dragOverCell === `${day.toISOString()}-${technician.email}`;
                      const isToday = isSameDay(day, new Date());

                      return (
                        <div
                          key={day.toISOString()}
                          className={`${compactMode ? 'p-1.5' : 'p-2'} border-r border-[#E5E7EB] transition-all overflow-y-auto ${
                            isDragOver ? 'bg-[#16A34A]/5 border-[#16A34A]' : isToday ? 'bg-[#FAE008]/5' : ''
                          }`}
                          onDragOver={(e) => handleDragOver(e, day, technician.email)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, technician.email)}
                        >
                          <div className={compactMode ? 'space-y-1' : 'space-y-1.5'}>
                            {jobsInCell.map(job => {
                              const isPriority = job.priority === 'high' || job.outcome === 'return_visit_required';
                              
                              return (
                                <JobHoverCard key={job.id} job={job} onJobClick={onJobClick}>
                                  <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, job)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onJobClick(job)}
                                    className={`${compactMode ? 'p-2' : 'p-2.5'} rounded-lg cursor-move hover:shadow-md transition-all bg-white border border-[#E5E7EB] hover:border-[#FAE008] ${
                                      draggedJob?.id === job.id ? 'opacity-50' : ''
                                    }`}
                                  >
                                    <div className="space-y-1.5">
                                      <div className={`${compactMode ? 'text-[11px]' : 'text-xs'} font-semibold text-[#111827] leading-tight truncate`}>
                                        {job.customer_name}
                                      </div>

                                      <div className="flex items-center gap-1 flex-wrap">
                                        <Badge className="bg-[#F2F4F7] text-[#344054] hover:bg-[#F2F4F7] border-0 font-medium text-[9px] px-1.5 py-0 rounded">
                                          #{job.job_number}
                                        </Badge>
                                        {isPriority && (
                                          <Badge className="bg-[#FED7AA] text-[#9A3412] hover:bg-[#FED7AA] border-0 font-semibold text-[9px] px-1.5 py-0 rounded">
                                            <AlertTriangle className="w-2.5 h-2.5" />
                                          </Badge>
                                        )}
                                        <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] border-0 font-semibold text-[9px] px-1.5 py-0 rounded">
                                          <Clock className="w-2.5 h-2.5 mr-0.5" />
                                          {job.scheduled_time?.slice(0, 5) || 'TBD'}
                                        </Badge>
                                      </div>

                                      {!compactMode && (
                                        <div className="flex items-start gap-1 text-[10px] text-[#4B5563] truncate">
                                          <MapPin className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
                                          <span className="truncate">{job.address}</span>
                                        </div>
                                      )}

                                      {job.job_type_name && (
                                        <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-[9px] px-1.5 py-0.5 rounded truncate w-full justify-start">
                                          <Briefcase className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                                          <span className="truncate">{job.job_type_name}</span>
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </JobHoverCard>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
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

      <AlertDialog open={!!pendingUpdate} onOpenChange={() => setPendingUpdate(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-[#111827]">
              <AlertCircle className="w-5 h-5 text-[#D97706]" />
              Confirm Job Reschedule
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-[#4B5563]">
              <p className="font-bold text-[#111827] text-base">
                Job #{pendingUpdate?.job.job_number} - {pendingUpdate?.job.customer_name}
              </p>
              {pendingUpdate?.dateChanged && (
                <p className="text-sm">
                  <span className="font-semibold">Date:</span>{' '}
                  <span className="line-through text-[#6B7280]">
                    {pendingUpdate?.oldDate && format(new Date(pendingUpdate.oldDate), 'MMM d, yyyy')}
                  </span>
                  {' → '}
                  <span className="font-bold text-[#111827]">
                    {pendingUpdate?.newDate && format(new Date(pendingUpdate.newDate), 'MMM d, yyyy')}
                  </span>
                </p>
              )}
              {pendingUpdate?.technicianChanged && (
                <p className="text-sm">
                  <span className="font-semibold">Technician:</span>{' '}
                  <span className="line-through text-[#6B7280]">{pendingUpdate?.oldAssignedToName}</span>
                  {' → '}
                  <span className="font-bold text-[#111827]">{pendingUpdate?.newAssignedToDisplay}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpdate}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] rounded-lg font-semibold shadow-md"
            >
              Confirm Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}