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
  open: "rgba(37, 99, 235, 0.15)",
  scheduled: "#FAE008",
  in_progress: "rgba(14, 165, 233, 0.15)",
  completed: "rgba(21, 128, 61, 0.15)",
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
  "bg-[#FAE008]", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-indigo-500", "bg-red-500", "bg-teal-500",
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
  const [clickTimer, setClickTimer] = useState(null);
  const queryClient = useQueryClient();

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

  const handleJobClick = (e, job) => {
    if (clickTimer) {
      // Double click detected
      clearTimeout(clickTimer);
      setClickTimer(null);
      onJobClick(job); // Open full details
    } else {
      // Single click - wait to see if double click follows
      const timer = setTimeout(() => {
        setClickTimer(null);
        // Single click - let hover card handle it
      }, 250);
      setClickTimer(timer);
    }
  };

  const handleDragStart = (e, job) => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }
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
              <div className="grid border-b border-[#E5E7EB] bg-white" style={{ gridTemplateColumns: `200px repeat(${weekDays.length}, 1fr)` }}>
                <div className="p-3 border-r border-[#E5E7EB] font-semibold text-sm text-[#111827]">
                  Technician
                </div>
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="text-center p-3 border-r border-[#E5E7EB]">
                    <div className={`text-xs font-medium ${isSameDay(day, new Date()) ? 'text-[#FAE008]' : 'text-[#4B5563]'}`}>
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-[#FAE008]' : 'text-[#111827]'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {visibleTechnicians.length === 0 ? (
                <div className="p-8 text-center text-[#4B5563]">
                  No technicians assigned to jobs this week.
                </div>
              ) : (
                visibleTechnicians.map(technician => (
                  <div key={technician.id} className="grid border-b border-[#E5E7EB] hover:bg-gray-50" style={{ gridTemplateColumns: `200px repeat(${weekDays.length}, 1fr)`, height: '150px' }}>
                    <div className="p-3 border-r border-[#E5E7EB] flex items-center gap-2 sticky left-0 bg-white z-10">
                      <div className={`${getAvatarColor(technician.full_name)} w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs`}>
                        {getInitials(technician.full_name)}
                      </div>
                      <span className="text-sm font-semibold text-[#111827] truncate">
                        {technician.full_name}
                      </span>
                    </div>

                    {weekDays.map(day => {
                      const jobsInCell = getJobsForCell(day, technician.email);
                      const isDragOver = dragOverCell === `${day.toISOString()}-${technician.email}`;

                      return (
                        <div
                          key={day.toISOString()}
                          className={`p-2 border-r border-[#E5E7EB] transition-colors overflow-y-auto ${
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
                                  onClick={(e) => handleJobClick(e, job)}
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onDragEnd={handleDragEnd}
                                  className={`p-2 rounded-lg cursor-move hover:shadow-md transition-all border-l-4 bg-white ${
                                    draggedJob?.id === job.id ? 'opacity-50' : ''
                                  }`}
                                  style={{ 
                                    borderLeftColor: statusColors[job.status] || '#FAE008',
                                    backgroundColor: typeof statusColors[job.status] === 'string' && statusColors[job.status].startsWith('rgba') ? statusColors[job.status] : 'white'
                                  }}
                                >
                                  <div className="text-xs font-semibold text-[#111827] truncate mb-1">
                                    #{job.job_number}
                                  </div>
                                  <div className="text-xs text-[#4B5563] truncate mb-1">
                                    {job.customer_name}
                                  </div>
                                  <div className="flex items-start gap-1 text-xs text-[#4B5563] truncate">
                                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span className="truncate">{job.address}</span>
                                  </div>
                                  {job.job_type_name && (
                                    <div className="text-xs text-[#4B5563] font-medium mt-1 truncate">
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

        <div className="flex flex-wrap gap-2 text-xs bg-white p-3 rounded-lg border border-[#E5E7EB]">
          <span className="font-semibold text-[#111827]">Job Types:</span>
          {uniqueJobTypes.map((jobType) => (
            <div key={jobType} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
              <span className="text-[#4B5563]">{jobType}</span>
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
              <p className="font-medium text-[hsl(25,10%,12%)]">
                Job #{pendingUpdate?.job.job_number} - {pendingUpdate?.job.customer_name}
              </p>
              {pendingUpdate?.dateChanged && (
                <p>
                  <span className="text-[hsl(25,8%,45%)]">Date:</span>{' '}
                  <span className="line-through text-[hsl(25,8%,55%)]">
                    {pendingUpdate?.oldDate && format(new Date(pendingUpdate.oldDate), 'MMM d, yyyy')}
                  </span>
                  {' → '}
                  <span className="font-medium text-[#fae008]">
                    {pendingUpdate?.newDate && format(new Date(pendingUpdate.newDate), 'MMM d, yyyy')}
                  </span>
                </p>
              )}
              {pendingUpdate?.technicianChanged && (
                <p>
                  <span className="text-[hsl(25,8%,45%)]">Technician:</span>{' '}
                  <span className="line-through text-[hsl(25,8%,55%)]">{pendingUpdate?.oldAssignedToName}</span>
                  {' → '}
                  <span className="font-medium text-[#fae008]">{pendingUpdate?.newAssignedToDisplay}</span>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpdate}
              className="bg-[#fae008] text-[hsl(25,10%,12%)] hover:bg-[#e5d007]"
            >
              Confirm Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}