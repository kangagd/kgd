import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { MapPin, AlertCircle } from "lucide-react";
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

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
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
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}>
                <div className="p-3 border-r border-slate-200 font-medium text-sm text-slate-700">
                  Technician
                </div>
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="text-center p-3 border-r border-slate-200">
                    <div className={`text-xs font-medium ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-500'}`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {visibleTechnicians.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No technicians assigned to jobs this week.
                </div>
              ) : (
                visibleTechnicians.map(technician => (
                  <div key={technician.id} className="grid border-b border-slate-200 hover:bg-slate-50" style={{ gridTemplateColumns: '200px repeat(7, 1fr)', height: '150px' }}>
                    <div className="p-3 border-r border-slate-200 flex items-center gap-2 sticky left-0 bg-white z-10">
                      <div className={`${getAvatarColor(technician.full_name)} w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                        {getInitials(technician.full_name)}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {technician.full_name}
                      </span>
                    </div>

                    {weekDays.map(day => {
                      const jobsInCell = getJobsForCell(day, technician.email);
                      const isDragOver = dragOverCell === `${day.toISOString()}-${technician.email}`;

                      return (
                        <div
                          key={day.toISOString()}
                          className={`p-2 border-r border-slate-200 transition-colors overflow-y-auto ${
                            isDragOver ? 'bg-green-50 border-green-400' : ''
                          }`}
                          onDragOver={(e) => handleDragOver(e, day, technician.email)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, technician.email)}
                        >
                          <div className="space-y-1">
                            {jobsInCell.map(job => (
                              <JobHoverCard key={job.id} job={job} onJobClick={onJobClick}>
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onDragEnd={handleDragEnd}
                                  className={`p-2 rounded-lg cursor-move hover:shadow-md transition-all border-l-4 ${getJobTypeBgColor(job.job_type_name, uniqueJobTypes)} ${
                                    draggedJob?.id === job.id ? 'opacity-50' : ''
                                  }`}
                                  style={{ borderLeftColor: statusColors[job.status] || '#94a3b8' }}
                                >
                                  <div className="text-xs font-semibold text-slate-900 truncate mb-1">
                                    #{job.job_number}
                                  </div>
                                  <div className="text-xs text-slate-600 truncate mb-1">
                                    {job.customer_name}
                                  </div>
                                  <div className="flex items-start gap-1 text-xs text-slate-500 truncate">
                                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span className="truncate">{job.address}</span>
                                  </div>
                                  {job.job_type_name && (
                                    <div className="text-xs text-slate-600 font-medium mt-1 truncate">
                                      {job.job_type_name}
                                    </div>
                                  )}
                                </div>
                              </JobHoverCard>
                            ))}
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
              {pendingUpdate?.dateChanged && (
                <p>
                  <span className="text-slate-600">Date:</span>{' '}
                  <span className="line-through text-slate-400">
                    {pendingUpdate?.oldDate && format(new Date(pendingUpdate.oldDate), 'MMM d, yyyy')}
                  </span>
                  {' → '}
                  <span className="font-medium text-blue-600">
                    {pendingUpdate?.newDate && format(new Date(pendingUpdate.newDate), 'MMM d, yyyy')}
                  </span>
                </p>
              )}
              {pendingUpdate?.technicianChanged && (
                <p>
                  <span className="text-slate-600">Technician:</span>{' '}
                  <span className="line-through text-slate-400">{pendingUpdate?.oldAssignedToName}</span>
                  {' → '}
                  <span className="font-medium text-blue-600">{pendingUpdate?.newAssignedToDisplay}</span>
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