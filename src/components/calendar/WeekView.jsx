import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, getDay } from "date-fns";
import { User, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
};

export default function WeekView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [hoveredJob, setHoveredJob] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const queryClient = useQueryClient();

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

  const getJobsForTechAndDay = (technicianEmail, day) => {
    return jobs.filter(job => {
      const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : [];
      return job.scheduled_date && 
             isSameDay(new Date(job.scheduled_date), day) &&
             assignedTo.includes(technicianEmail);
    }).sort((a, b) => {
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
    setDragOverZone(null);
  };

  const handleDragOver = (e, technicianEmail, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(`${technicianEmail}-${day.toISOString()}`);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e, technicianEmail, day) => {
    e.preventDefault();
    setDragOverZone(null);
    if (!draggedJob) return;

    const newDate = format(day, 'yyyy-MM-dd');
    const oldDate = draggedJob.scheduled_date;
    const assignedTo = Array.isArray(draggedJob.assigned_to) ? draggedJob.assigned_to : [];
    const assignedToName = Array.isArray(draggedJob.assigned_to_name) ? draggedJob.assigned_to_name : [];
    
    const technician = technicians.find(t => t.email === technicianEmail);
    const techChanged = !assignedTo.includes(technicianEmail);
    
    let newAssignedTo = assignedTo;
    let newAssignedToName = assignedToName;
    
    if (techChanged && technician) {
      newAssignedTo = [technicianEmail];
      newAssignedToName = [technician.full_name];
    }

    const dateChanged = newDate !== oldDate;

    if (!dateChanged && !techChanged) {
      setDraggedJob(null);
      return;
    }

    const oldTech = assignedToName.length > 0 ? assignedToName[0] : 'Unassigned';
    const newTech = newAssignedToName.length > 0 ? newAssignedToName[0] : 'Unassigned';

    setPendingUpdate({
      job: draggedJob,
      newDate,
      oldDate,
      newAssignedTo,
      newAssignedToName,
      oldTech,
      newTech,
      dateChanged,
      techChanged
    });

    setDraggedJob(null);
  };

  const confirmUpdate = () => {
    if (!pendingUpdate) return;

    const updateData = {
      scheduled_date: pendingUpdate.newDate
    };

    if (pendingUpdate.techChanged) {
      updateData.assigned_to = pendingUpdate.newAssignedTo;
      updateData.assigned_to_name = pendingUpdate.newAssignedToName;
    }

    updateJobMutation.mutate({
      id: pendingUpdate.job.id,
      data: updateData
    });
  };

  const handleMouseEnter = (e, job) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPosition({ x: rect.right + 10, y: rect.top });
    setHoveredJob(job);
  };

  const handleMouseLeave = () => {
    setHoveredJob(null);
  };

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header with days */}
              <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="w-40 flex-shrink-0 p-3 border-r border-slate-200 font-semibold text-sm text-slate-700">
                  Technician
                </div>
                {weekDays.map(day => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`flex-1 text-center p-3 border-r border-slate-200 ${
                        isToday ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Technician swimlanes */}
              {technicians.map(technician => (
                <div key={technician.id} className="flex border-b border-slate-200 hover:bg-slate-50/50">
                  <div className="w-40 flex-shrink-0 p-3 border-r border-slate-200 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {technician.full_name}
                    </span>
                  </div>
                  {weekDays.map(day => {
                    const dayJobs = getJobsForTechAndDay(technician.email, day);
                    const isToday = isSameDay(day, new Date());
                    const isDragOver = dragOverZone === `${technician.email}-${day.toISOString()}`;

                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex-1 p-2 border-r border-slate-200 min-h-[120px] transition-colors ${
                          isToday ? 'bg-blue-50/30' : ''
                        } ${isDragOver ? 'bg-green-100' : ''}`}
                        onDragOver={(e) => handleDragOver(e, technician.email, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, technician.email, day)}
                      >
                        <div className="space-y-1.5">
                          {dayJobs.map(job => (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, job)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={(e) => handleMouseEnter(e, job)}
                              onMouseLeave={handleMouseLeave}
                              onClick={() => onJobClick(job)}
                              className={`p-2 rounded-md cursor-move hover:shadow-md transition-all border-l-3 bg-white shadow-sm ${
                                draggedJob?.id === job.id ? 'opacity-50' : ''
                              }`}
                              style={{ borderLeftWidth: '3px', borderLeftColor: getJobTypeColor(job.job_type_name, uniqueJobTypes).replace('bg-', '#') }}
                            >
                              <div className="text-xs font-semibold text-slate-900 mb-0.5">
                                #{job.job_number}
                              </div>
                              <div className="text-xs text-slate-600 line-clamp-1 mb-1">
                                {job.address}
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] py-0 px-1 h-4 ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} text-white border-0`}
                              >
                                {job.product || job.job_type_name || 'N/A'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
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

      {hoveredJob && (
        <JobHoverCard 
          job={hoveredJob} 
          position={hoverPosition}
        />
      )}

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