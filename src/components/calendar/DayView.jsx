import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isSameDay } from "date-fns";
import { MapPin } from "lucide-react";

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
    
    const topPosition = ((jobTime - startHour) / (endHour - startHour + 1)) * 100;
    const duration = job.expected_duration || 1;
    const height = (duration / (endHour - startHour + 1)) * 100;
    
    return { top: `${topPosition}%`, height: `${height}%` };
  };

  if (dayJobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-slate-400 text-sm">No jobs scheduled for this day</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex">
            <div className="w-16 flex-shrink-0">
              {hours.map(hour => (
                <div key={hour} className="h-24 border-b border-slate-200 text-xs text-slate-500 pr-2 text-right">
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </div>
              ))}
            </div>
            
            <div className="flex-1 relative border-l border-slate-200">
              {hours.map(hour => (
                <div key={hour} className="h-24 border-b border-slate-200" />
              ))}
              
              {dayJobs.map(job => {
                const position = getJobPosition(job);
                if (!position) return null;
                
                return (
                  <div
                    key={job.id}
                    className={`absolute left-1 right-1 rounded-lg p-2 cursor-pointer hover:shadow-lg transition-shadow border-l-4 ${getJobTypeColor(job.job_type_name, uniqueJobTypes)} ${statusColors[job.status] || ''}`}
                    style={{ top: position.top, height: position.height, minHeight: '60px' }}
                    onClick={() => onJobClick(job)}
                  >
                    <div className="text-xs font-semibold text-slate-700 mb-1">
                      Job #{job.job_number}
                    </div>
                    <div className="font-semibold text-sm text-slate-900 mb-1 truncate">
                      {job.customer_name}
                    </div>
                    <div className="flex items-start gap-1 text-xs text-slate-600 mb-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="truncate">{job.address}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {job.product && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                          {job.product}
                        </Badge>
                      )}
                      {job.job_type_name && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                          {job.job_type_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}