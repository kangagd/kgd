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
import EntityModal from "../common/EntityModal";
import JobModalView from "../jobs/JobModalView";
import { createPageUrl } from "@/utils";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-slate-100 text-slate-800"
};

export default function CustomerEditModal({ customer, open, onClose, onSubmit, isSubmitting }) {
  const [modalJob, setModalJob] = React.useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer?.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }),
    enabled: !!customer?.id && open
  });

  const handleOpenFullJob = (job) => {
    setModalJob(null);
    window.location.href = `${createPageUrl("Jobs")}?jobId=${job.id}`;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid md:grid-cols-2 divide-x">
          <div className="overflow-y-auto max-h-[90vh]">
            <CustomerForm
              customer={customer}
              onSubmit={onSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[90vh] bg-slate-50">
            <h3 className="font-semibold text-lg mb-4">Job History ({jobs.length})</h3>
            {jobs.length === 0 ? (
              <p className="text-slate-500 text-sm">No jobs found</p>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div 
                    key={job.id} 
                    className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setModalJob(job)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-sm">#{job.job_number}</span>
                      <Badge className={statusColors[job.status]}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600 mb-2">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="text-xs">{job.address}</span>
                    </div>
                    {job.scheduled_date && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span className="text-xs">
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

    <EntityModal
      open={!!modalJob}
      onClose={() => setModalJob(null)}
      title={`Job #${modalJob?.job_number}`}
      onOpenFullPage={() => handleOpenFullJob(modalJob)}
      fullPageLabel="Open Full Job"
    >
      {modalJob && <JobModalView job={modalJob} />}
    </EntityModal>
    </>
  );
}