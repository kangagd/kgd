import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { MapPin, Phone, Mail, Calendar, Clock, User, Briefcase, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

export default function JobDetailsModal({ job, onClose }) {
  const navigate = useNavigate();

  const handleViewFull = () => {
    navigate(createPageUrl("Jobs") + `?id=${job.id}`);
  };

  return (
    <Dialog open={!!job} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {job.customer_name}
            <div className="text-sm font-normal text-slate-500 mt-1">Job #{job.job_number}</div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge className={statusColors[job.status]}>
              {job.status.replace('_', ' ')}
            </Badge>
            {job.priority !== 'medium' && (
              <Badge variant="outline">{job.priority} priority</Badge>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {job.customer_phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${job.customer_phone}`} className="hover:text-orange-600">
                    {job.customer_phone}
                  </a>
                </div>
              )}
              {job.customer_email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${job.customer_email}`} className="hover:text-orange-600 text-sm">
                    {job.customer_email}
                  </a>
                </div>
              )}
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <span>{job.address}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>
                  {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMMM d, yyyy')}
                </span>
              </div>
              {job.scheduled_time && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{job.scheduled_time}</span>
                </div>
              )}
              {job.job_type_name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>{job.job_type_name}</span>
                </div>
              )}
              {job.assigned_to_name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{job.assigned_to_name}</span>
                </div>
              )}
            </div>
          </div>

          {job.notes && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Notes</h4>
              <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg">
                {job.notes}
              </p>
            </div>
          )}

          {job.additional_info && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Additional Info</h4>
              <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg">
                {job.additional_info}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleViewFull} className="bg-orange-600 hover:bg-orange-700">
              View Full Details
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}