import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, Phone, Mail, Calendar, Clock, User, Briefcase } from "lucide-react";
import { format, parseISO } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

export default function JobDetails({ job, onClose, onEdit, onStatusChange }) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <CardTitle className="text-2xl font-bold">{job.customer_name}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">{job.job_number}</p>
            </div>
          </div>
          <Button onClick={() => onEdit(job)} className="bg-orange-600 hover:bg-orange-700">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex gap-2">
          <Badge className={statusColors[job.status]}>
            {job.status.replace('_', ' ')}
          </Badge>
          {job.priority && job.priority !== 'medium' && (
            <Badge variant="outline">{job.priority} priority</Badge>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-3">Customer Information</h3>
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
                  <a href={`mailto:${job.customer_email}`} className="hover:text-orange-600">
                    {job.customer_email}
                  </a>
                </div>
              )}
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <span>{job.address}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-3">Job Details</h3>
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
        </div>

        {job.notes && (
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Notes & Instructions</h3>
            <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">
              {job.notes}
            </p>
          </div>
        )}

        {job.completion_notes && (
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Completion Notes</h3>
            <p className="text-slate-700 whitespace-pre-wrap bg-green-50 p-4 rounded-lg">
              {job.completion_notes}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-medium text-slate-500">Quick Actions:</h3>
          <div className="flex gap-2 flex-wrap">
            {job.status === 'scheduled' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange('in_progress')}
              >
                Start Job
              </Button>
            )}
            {job.status === 'in_progress' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange('completed')}
                className="text-green-700 border-green-300 hover:bg-green-50"
              >
                Complete Job
              </Button>
            )}
            {job.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange('cancelled')}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                Cancel Job
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}