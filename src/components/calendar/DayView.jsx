import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { Clock, MapPin, User } from "lucide-react";

const jobTypeColors = [
  "border-l-blue-500", "border-l-green-500", "border-l-orange-500", 
  "border-l-purple-500", "border-l-indigo-500", "border-l-amber-500",
  "border-l-red-500", "border-l-cyan-500", "border-l-teal-500", 
  "border-l-pink-500", "border-l-rose-500", "border-l-lime-500",
];

const statusColors = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-700",
};

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "border-l-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return jobTypeColors[index % jobTypeColors.length];
};

export default function DayView({ jobs, currentDate, onJobClick }) {
  const dayJobs = jobs.filter(job => 
    job.scheduled_date && isSameDay(new Date(job.scheduled_date), currentDate)
  ).sort((a, b) => {
    if (!a.scheduled_time) return 1;
    if (!b.scheduled_time) return -1;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });

  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

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
      <div className="grid gap-3">
        {dayJobs.map((job) => (
          <Card 
            key={job.id}
            className={`hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getJobTypeColor(job.job_type_name, uniqueJobTypes)}`}
            onClick={() => onJobClick(job)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">
                    {job.customer_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{job.scheduled_time || 'No time set'}</span>
                  </div>
                </div>
                <Badge className={statusColors[job.status]}>
                  {job.status?.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{job.address}</span>
                </div>

                {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-4 h-4" />
                    <span>{job.assigned_to_name.join(', ')}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {job.job_type_name && (
                    <Badge variant="outline" className="text-xs">
                      {job.job_type_name}
                    </Badge>
                  )}
                  {job.product && (
                    <Badge variant="outline" className="text-xs">
                      {job.product}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}