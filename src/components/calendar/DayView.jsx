import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isSameDay, format } from "date-fns";
import { MapPin, User, AlertCircle, Clock, Briefcase, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
  scheduled: "bg-[#FAE008]",
  in_progress: "bg-[#D97706]",
  completed: "bg-[#16A34A]",
  cancelled: "bg-[#F3F4F6]",
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

const parseTime = (timeString) => {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
};

export default function DayView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const queryClient = useQueryClient();
  const compactMode = true;

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPendingUpdate(null);
    }
  });

  const dayJobs = jobs.filter(job => 
    job.scheduled_date && isSameDay(new Date(job.scheduled_date), currentDate)
  );

  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  // Determine hour range
  let startHour = 7;
  let endHour = 17;
  
  dayJobs.forEach(job => {
    const jobTime = parseTime(job.scheduled_time);
    if (jobTime !== null) {
      startHour = Math.min(startHour, Math.floor(jobTime));
      const jobDuration = job.expected_duration || 1;
      endHour = Math.max(endHour, Math.ceil(jobTime + jobDuration));
    }
  });

  const hours = [];
  for (let i = startHour; i <= endHour; i++) {
    hours.push(i);
  }

  const getJobPosition = (job) => {
    const jobTime = parseTime(job.scheduled_time);
    if (jobTime === null) return null;
    
    const leftPosition = ((jobTime - startHour) / (endHour - startHour + 1)) * 100;
    const duration = job.expected_duration || 1;
    const width = (duration / (endHour - startHour + 1)) * 100;
    
    return { left: `${leftPosition}%`, width: `${width}%` };
  };

  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedJob(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e, technicianEmail, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(`${technicianEmail}-${hour}`);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e, technicianEmail, hour) => {
    e.preventDefault();
    setDragOverZone(null);
    if (!draggedJob) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const minutes = Math.round((offsetX / rect.width) * 60);
    const newTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    const assignedTo = Array.isArray(draggedJob.assigned_to) ? draggedJob.assigned_to : [];
    const assignedToName = Array.isArray(draggedJob.assigned_to_name) ? draggedJob.assigned_to_name : [];
    
    const technicianIndex = assignedTo.indexOf(technicianEmail);
    let newAssignedTo = [...assignedTo];
    let newAssignedToName = [...assignedToName];

    const technician = technicians.find(t => t.email === technicianEmail);
    if (technicianIndex === -1 && technician) {
      newAssignedTo = [technicianEmail];
      newAssignedToName = [technician.full_name];
    }

    const oldTech = assignedToName.length > 0 ? assignedToName[0] : 'Unassigned';
    const newTech = newAssignedToName.length > 0 ? newAssignedToName[0] : 'Unassigned';
    const timeChanged = draggedJob.scheduled_time !== newTime;
    const techChanged = oldTech !== newTech;

    setPendingUpdate({
      job: draggedJob,
      newTime,
      newAssignedTo,
      newAssignedToName,
      oldTech,
      newTech,
      timeChanged,
      techChanged
    });

    setDraggedJob(null);
  };

  const confirmUpdate = () => {
    if (!pendingUpdate) return;

    updateJobMutation.mutate({
      id: pendingUpdate.job.id,
      data: {
        scheduled_time: pendingUpdate.newTime,
        assigned_to: pendingUpdate.newAssignedTo,
        assigned_to_name: pendingUpdate.newAssignedToName
      }
    });
  };

  if (technicians.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-[hsl(25,8%,55%)] text-sm">No technicians found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Card className="rounded-lg border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header with hours */}
              <div className="flex border-b border-[#E5E7EB] bg-[#F8F9FA] sticky top-0 z-10">
                <div className={`${compactMode ? 'w-32' : 'w-40'} flex-shrink-0 ${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] font-bold text-xs text-[#111827] tracking-tight uppercase`}>
                  Technician
                </div>
                <div className="flex-1 flex">
                  {hours.map(hour => (
                    <div key={hour} className={`flex-1 text-center ${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider`}>
                      {hour === 12 ? '12P' : hour > 12 ? `${hour - 12}P` : `${hour}A`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Technician rows */}
              {technicians.map(technician => {
                const techJobs = dayJobs.filter(job => {
                  const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : [];
                  return assignedTo.includes(technician.email);
                });

                return (
                  <div key={technician.id} className="flex border-b border-[#E5E7EB] hover:bg-[#F8F9FA]/50 transition-colors">
                    <div className={`${compactMode ? 'w-32' : 'w-40'} flex-shrink-0 ${compactMode ? 'p-2' : 'p-3'} border-r border-[#E5E7EB] flex items-center gap-2`}>
                      <User className={`${compactMode ? 'w-4 h-4' : 'w-5 h-5'} text-[#6B7280]`} />
                      <span className={`${compactMode ? 'text-xs' : 'text-sm'} font-bold text-[#111827] truncate`}>
                        {technician.full_name}
                      </span>
                    </div>
                    <div className={`flex-1 relative ${compactMode ? 'h-20' : 'h-28'}`}>
                      {hours.map(hour => (
                        <div 
                          key={hour} 
                          className={`absolute top-0 bottom-0 border-r border-[#E5E7EB] transition-colors ${
                            dragOverZone === `${technician.email}-${hour}` ? 'bg-[#FAE008]/20' : ''
                          }`}
                          style={{ 
                            left: `${((hour - startHour) / (endHour - startHour + 1)) * 100}%`,
                            width: `${(1 / (endHour - startHour + 1)) * 100}%`
                          }}
                          onDragOver={(e) => handleDragOver(e, technician.email, hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, technician.email, hour)}
                        />
                      ))}
                      
                      {techJobs.map(job => {
                        const position = getJobPosition(job);
                        if (!position) return null;
                        const isPriority = job.priority === 'high' || job.outcome === 'return_visit_required';
                        
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, job)}
                            onDragEnd={handleDragEnd}
                            className={`absolute ${compactMode ? 'top-2 bottom-2' : 'top-3 bottom-3'} rounded-lg ${compactMode ? 'p-2' : 'p-2.5'} cursor-move hover:shadow-md transition-all bg-white border border-[#E5E7EB] hover:border-[#FAE008] ${
                              draggedJob?.id === job.id ? 'opacity-50' : ''
                            }`}
                            style={{ left: position.left, width: position.width, minWidth: compactMode ? '120px' : '140px' }}
                            onClick={() => onJobClick(job)}
                          >
                            <div className="space-y-1">
                              <div className={`${compactMode ? 'text-[11px]' : 'text-xs'} font-semibold text-[#111827] leading-tight truncate`}>
                                {job.customer_name}
                              </div>

                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge className="bg-[#F2F4F7] text-[#344054] hover:bg-[#F2F4F7] border-0 font-medium text-[9px] px-1.5 py-0 rounded-md">
                                  #{job.job_number}
                                </Badge>
                                {isPriority && (
                                  <Badge className="bg-[#FED7AA] text-[#9A3412] hover:bg-[#FED7AA] border-0 font-semibold text-[9px] px-1.5 py-0 rounded-md">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                  </Badge>
                                )}
                                <Badge className="bg-[#FAE008] text-[#111827] hover:bg-[#FAE008] border-0 font-semibold text-[9px] px-1.5 py-0 rounded-md">
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
                                <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-[9px] px-1.5 py-0.5 rounded-md truncate w-full justify-start">
                                  <Briefcase className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                                  <span className="truncate">{job.job_type_name}</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
              {pendingUpdate?.timeChanged && (
                <p className="text-sm">
                  <span className="font-semibold">Time:</span>{' '}
                  <span className="line-through text-[#6B7280]">{pendingUpdate?.job.scheduled_time?.slice(0, 5)}</span>
                  {' → '}
                  <span className="font-bold text-[#111827]">{pendingUpdate?.newTime?.slice(0, 5)}</span>
                </p>
              )}
              {pendingUpdate?.techChanged && (
                <p className="text-sm">
                  <span className="font-semibold">Technician:</span>{' '}
                  <span className="line-through text-[#6B7280]">{pendingUpdate?.oldTech}</span>
                  {' → '}
                  <span className="font-bold text-[#111827]">{pendingUpdate?.newTech}</span>
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