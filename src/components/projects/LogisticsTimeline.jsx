import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { Briefcase, Truck, Calendar, User, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const LOGISTICS_JOB_TYPES = [
  "Material Pickup – Warehouse",
  "Material Pickup – Supplier",
  "Material Delivery – Supplier",
  "Delivery – At Warehouse",
  "Delivery – To Client",
  "Return to Supplier"
];

export default function LogisticsTimeline({ project }) {
  const navigate = useNavigate();

  const { data: jobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: async () => {
      const projectJobs = await base44.entities.Job.filter({ project_id: project.id });
      return projectJobs.filter(job => 
        !job.deleted_at && 
        LOGISTICS_JOB_TYPES.some(type => (job.job_type_name || job.job_type || "").includes(type) || (job.job_type_name || "").includes("Pickup") || (job.job_type_name || "").includes("Delivery"))
      ).sort((a, b) => new Date(a.scheduled_date || a.created_date) - new Date(b.scheduled_date || b.created_date));
    },
    enabled: !!project.id
  });

  if (jobs.length === 0) return (
    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
      <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-500">No logistics jobs scheduled yet.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Logistics Timeline</h3>
      <div className="relative pl-4 border-l-2 border-slate-200 space-y-6">
        {jobs.map((job, index) => {
          const isCompleted = job.status === "Completed";
          const date = job.scheduled_date ? parseISO(job.scheduled_date) : parseISO(job.created_date);
          
          const isStockJob = !!job.purchase_order_id;
          const isProjectJob = !!job.project_id;
          const containerClasses = `p-3 rounded-lg border shadow-sm transition-all cursor-pointer ${
              isProjectJob 
                  ? "bg-sky-50/30 border-sky-200 hover:border-sky-300 hover:shadow-md" 
                  : isStockJob 
                      ? "bg-amber-50/30 border-amber-200 hover:border-amber-300 hover:shadow-md" 
                      : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md"
          }`;

          return (
            <div key={job.id} className="relative">
              {/* Timeline Dot */}
              <div className={`absolute -left-[21px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                isCompleted ? 'border-green-500 text-green-500' : 'border-slate-300 text-slate-300'
              } flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-slate-300'}`} />
              </div>

              <div 
                onClick={() => navigate(createPageUrl("Jobs") + `?jobId=${job.id}`)}
                className={containerClasses}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      {job.job_type_name || job.job_type}
                      {isStockJob && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          PO
                        </span>
                      )}
                      <span className="text-xs font-normal text-slate-500">#{job.job_number}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(date, 'MMM d, yyyy')}
                      </span>
                      {job.scheduled_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={isCompleted ? "default" : "outline"} className={
                    isCompleted ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : "bg-slate-100 text-slate-700 border-slate-200"
                  }>
                    {job.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    {job.assigned_to_name && job.assigned_to_name.length > 0 
                      ? job.assigned_to_name.join(", ") 
                      : "Unassigned"
                    }
                  </div>
                  {/* Assuming we can count parts from notes or fetch - simplified for now */}
                  <div className="flex items-center gap-1 text-blue-600 font-medium">
                    View Job <Truck className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}