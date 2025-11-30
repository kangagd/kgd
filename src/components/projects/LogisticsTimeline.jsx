import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { Truck, Calendar, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LogisticsTimeline({ project, part }) {
  const navigate = useNavigate();

  const { data: jobs = [] } = useQuery({
    queryKey: part ? ['partLogisticsJobs', part.id] : ['projectLogisticsJobs', project?.id],
    queryFn: async () => {
      if (part) {
        if (!part.linked_logistics_jobs || part.linked_logistics_jobs.length === 0) return [];
        // Fetch specific jobs linked to part
        const jobs = await Promise.all(part.linked_logistics_jobs.map(id => base44.entities.Job.get(id).catch(() => null)));
        return jobs.filter(j => j && !j.deleted_at).sort((a, b) => new Date(a.scheduled_date || a.created_date) - new Date(b.scheduled_date || b.created_date));
      } else if (project) {
        const projectJobs = await base44.entities.Job.filter({ project_id: project.id });
        return projectJobs.filter(job => 
          !job.deleted_at && 
          (job.job_category === 'Logistics' || 
           (job.job_type_name || job.job_type || "").includes("Pickup") || 
           (job.job_type_name || job.job_type || "").includes("Delivery"))
        ).sort((a, b) => new Date(a.scheduled_date || a.created_date) - new Date(b.scheduled_date || b.created_date));
      }
      return [];
    },
    enabled: !!(part || project?.id)
  });

  if (jobs.length === 0) return (
    <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
      <Truck className="w-6 h-6 text-slate-300 mx-auto mb-2" />
      <p className="text-xs text-slate-500">No logistics jobs linked.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Logistics Timeline</h3>
      <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
        {jobs.map((job) => {
          const isCompleted = job.status === "Completed";
          const date = job.scheduled_date ? parseISO(job.scheduled_date) : parseISO(job.created_date);
          
          return (
            <div key={job.id} className="relative">
              {/* Timeline Dot */}
              <div className={`absolute -left-[21px] top-3 w-3 h-3 rounded-full border-2 bg-white ${
                isCompleted ? 'border-green-500' : 'border-slate-300'
              } flex items-center justify-center`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>

              <div 
                onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm text-slate-900">
                    {job.logistics_type || job.job_type_name || job.job_type}
                  </div>
                  <Badge variant={isCompleted ? "default" : "outline"} className={`text-[10px] px-1.5 h-5 ${
                    isCompleted ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>
                    {job.status}
                  </Badge>
                </div>
                
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(date, 'MMM d')}
                  </span>
                  {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {job.assigned_to_name[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}