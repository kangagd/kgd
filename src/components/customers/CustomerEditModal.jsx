import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CustomerForm from "./CustomerForm";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-50 text-blue-900 border-blue-200 border-2",
  in_progress: "bg-orange-50 text-orange-900 border-orange-200 border-2",
  completed: "bg-green-50 text-green-900 border-green-200 border-2",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200 border-2"
};

export default function CustomerEditModal({ customer, open, onClose, onSubmit, isSubmitting }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer?.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }),
    enabled: !!customer?.id && open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 border-2 border-slate-300 shadow-2xl rounded-2xl">
        <div className="grid md:grid-cols-2 divide-x-2 divide-slate-200">
          <div className="overflow-y-auto max-h-[90vh]">
            <CustomerForm
              customer={customer}
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[90vh] bg-gradient-to-br from-slate-50 to-slate-100">
            <h3 className="font-bold text-xl text-[#000000] mb-5 tracking-tight">Job History ({jobs.length})</h3>
            {jobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 font-medium">No jobs found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map(job => (
                  <div key={job.id} className="bg-white rounded-xl border-2 border-slate-200 p-4 hover:shadow-lg hover:border-slate-300 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-bold text-base text-[#000000]">#{job.job_number}</span>
                      <Badge className={`${statusColors[job.status]} font-semibold`}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700 mb-3">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                      <span className="text-sm font-medium">{job.address}</span>
                    </div>
                    {job.scheduled_date && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">
                          {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}