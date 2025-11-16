import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isSameDay, format } from "date-fns";
import { MapPin, User, AlertCircle } from "lucide-react";
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

const statusColors = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
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
          <div className="text-slate-400 text-sm">No technicians found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header with hours */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="w-32 flex-shrink-0 p-2 border-r border-slate-200 font-medium text-sm text-slate-700">
                  Technician
                </div>
                <div className="flex-1 flex">
                  {hours.map(hour => (
                    <div key={hour} className="flex-1 text-center p-2 border-r border-slate-200 text-xs text-slate-600">
                      {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
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
                  <div key={technician.id} className="flex border-b border-slate-200 hover:bg-slate-50">
                    <div className="w-32 flex-shrink-0 p-3 border-r border-slate-200 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {technician.full_name}
                      </span>
                    </div>
                    <div className="flex-1 relative h-24">
                      {hours.map(hour => (
                        <div 
                          key={hour} 
                          className={`absolute top-0 bottom-0 border-r border-slate-200 transition-colors ${
                            dragOverZone === `${technician.email}-${hour}` ? 'bg-blue-100' : ''
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
                        
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, job)}
                            onDragEnd={handleDragEnd}
                            className={`absolute top-2 bottom-2 rounded-lg p-2 cursor-move hover:shadow-lg transition-all border-l-4 ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} ${statusColors[job.status] || ''} ${
                              draggedJob?.id === job.id ? 'opacity-50' : ''
                            }`}
                            style={{ left: position.left, width: position.width, minWidth: '120px' }}
                            onClick={() => onJobClick(job)}
                          >
                            <div className="text-xs font-semibold text-slate-700 mb-1 truncate">
                              Job #{job.job_number}
                            </div>
                            <div className="font-semibold text-sm text-slate-900 mb-1 truncate">
                              {job.customer_name}
                            </div>
                            <div className="flex items-start gap-1 text-xs text-slate-600 truncate">
                              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="truncate">{job.address}</span>
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

      <AlertDialog open={!!pendingUpdate} onOpenChange={() => setPendingUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Confirm Job Reschedule
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-medium text-slate-900">
                Job #{pendingUpdate?.job.job_number} - {pendingUpdate?.job.customer_name}
              </p>
              {pendingUpdate?.timeChanged && (
                <p>
                  <span className="text-slate-600">Time:</span>{' '}
                  <span className="line-through text-slate-400">{pendingUpdate?.job.scheduled_time?.slice(0, 5)}</span>
                  {' → '}
                  <span className="font-medium text-blue-600">{pendingUpdate?.newTime?.slice(0, 5)}</span>
                </p>
              )}
              {pendingUpdate?.techChanged && (
                <p>
                  <span className="text-slate-600">Technician:</span>{' '}
                  <span className="line-through text-slate-400">{pendingUpdate?.oldTech}</span>
                  {' → '}
                  <span className="font-medium text-blue-600">{pendingUpdate?.newTech}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpdate}
              className="bg-[#fae008] text-slate-950 hover:bg-[#fae008]/90"
            >
              Confirm Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}