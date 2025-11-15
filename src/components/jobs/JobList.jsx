import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, User, Briefcase, FileText, Tag } from "lucide-react";
import { format, parseISO } from "date-fns";

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

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700",
  "Builder": "bg-blue-100 text-blue-700",
  "Real Estate - Tenant": "bg-green-100 text-green-700",
  "Strata - Owner": "bg-amber-100 text-amber-700",
};

export default function JobList({ jobs, isLoading, onSelectJob }) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </CardContent>
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
        <p className="text-slate-500">Try adjusting your filters</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <Card 
          key={job.id}
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onSelectJob(job)}
        >
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-900">{job.customer_name}</h3>
                <p className="text-sm text-slate-500">Job #{job.job_number}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
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

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{job.address}</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{job.scheduled_time}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {job.customer_type && (
                  <Badge variant="outline" className={customerTypeColors[job.customer_type]}>
                    <Tag className="w-3 h-3 mr-1" />
                    {job.customer_type}
                  </Badge>
                )}
                
                {job.assigned_to_name && (
                  <Badge variant="outline" className="text-slate-700">
                    <User className="w-3 h-3 mr-1" />
                    {job.assigned_to_name}
                  </Badge>
                )}
                
                {job.job_type_name && (
                  <Badge variant="outline" className="text-slate-700">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {job.job_type_name}
                  </Badge>
                )}
              </div>

              {job.notes && (
                <div className="flex items-start gap-2 text-slate-600 pt-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm line-clamp-2">{job.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}