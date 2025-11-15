import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Calendar, Clock, User, Briefcase, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

export default function JobDetailsModal({ job, onClose }) {
  if (!job) return null;

  return (
    <Dialog open={!!job} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">{job.customer_name}</div>
              <div className="text-sm font-normal text-slate-500">Job #{job.job_number}</div>
            </div>
            <Badge className={statusColors[job.status]}>
              {job.status.replace('_', ' ')}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
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
                <a href={`mailto:${job.customer_email}`} className="hover:text-orange-600">
                  {job.customer_email}
                </a>
              </div>
            )}
            <div className="flex items-start gap-2 text-slate-700 md:col-span-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <span>{job.address}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-sm">
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

          {job.notes && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Notes</h4>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">
                {job.notes}
              </p>
            </div>
          )}

          {job.additional_info && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Additional Info</h4>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">
                {job.additional_info}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Link to={createPageUrl("Jobs") + `?id=${job.id}`}>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Details
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}