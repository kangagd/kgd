import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isSameDay } from "date-fns";
import { MapPin, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

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

export default function DayView({ jobs, currentDate, onJobClick }) {
  const [draggedJob, setDraggedJob] = useState(null);
  const queryClient = useQueryClient();

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, technicianEmail, hour) => {
    e.preventDefault();
    if (!draggedJob) return;

    const minutes = Math.round((e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * 60);
    const newTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    const assignedTo = Array.isArray(draggedJob.assigned_to) ? draggedJob.assigned_to : [];
    const assignedToName = Array.isArray(draggedJob.assigned_to_name) ? draggedJob.assigned_to_name : [];
    
    const technicianIndex = assignedTo.indexOf(technicianEmail);
    let newAssignedTo = [...assignedTo];
    let newAssignedToName = [...assignedToName];

    if (technicianIndex === -1) {
      const technician = technicians.find(t => t.email === technicianEmail);
      if (technician) {
        newAssignedTo = [technicianEmail];
        newAssignedToName = [technician.full_name];
      }
    }

    updateJobMutation.mutate({
      id: draggedJob.id,
      data: {
        scheduled_time: newTime,
        assigned_to: newAssignedTo,
        assigned_to_name: newAssignedToName
      }
    });

    setDraggedJob(null);
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
                        className="absolute top-0 bottom-0 border-r border-slate-200"
                        style={{ 
                          left: `${((hour - startHour) / (endHour - startHour + 1)) * 100}%`,
                          width: `${(1 / (endHour - startHour + 1)) * 100}%`
                        }}
                        onDragOver={handleDragOver}
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
                          className={`absolute top-2 bottom-2 rounded-lg p-2 cursor-move hover:shadow-lg transition-shadow border-l-4 ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} ${statusColors[job.status] || ''}`}
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
    </div>
  );
}