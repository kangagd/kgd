import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { MapPin, Clock, User, Briefcase } from "lucide-react";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

export default function JobList({ jobs, isLoading, onSelectJob }) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Briefcase className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No jobs found</h3>
        <p className="text-slate-500">Try adjusting your search or filters</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="p-6 hover:shadow-md transition-all cursor-pointer border-none"
          onClick={() => onSelectJob(job)}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{job.customer_name}</h3>
                  <p className="text-sm text-slate-500 mt-1">Job #{job.job_number}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={statusColors[job.status]}>
                    {job.status.replace('_', ' ')}
                  </Badge>
                  {job.priority !== 'medium' && (
                    <Badge className={priorityColors[job.priority]}>
                      {job.priority}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{job.address}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                    {job.scheduled_time && ` at ${job.scheduled_time}`}
                  </span>
                </div>

                {job.assigned_to_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{job.assigned_to_name}</span>
                  </div>
                )}

                {job.job_type_name && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span>{job.job_type_name}</span>
                  </div>
                )}
              </div>

              {job.notes && (
                <p className="mt-3 text-sm text-slate-500 line-clamp-2">{job.notes}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}