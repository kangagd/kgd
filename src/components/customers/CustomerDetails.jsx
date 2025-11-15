import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Phone, Mail, Calendar, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CustomerDetails({ customer, onClose, onEdit }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }, '-scheduled_date'),
  });

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <CardTitle className="text-2xl font-bold">{customer.name}</CardTitle>
                {customer.status === 'inactive' && (
                  <Badge variant="outline" className="mt-2">Inactive</Badge>
                )}
              </div>
            </div>
            <Button onClick={() => onEdit(customer)} className="bg-orange-600 hover:bg-orange-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-3">Contact Information</h3>
            <div className="space-y-3">
              {customer.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${customer.phone}`} className="hover:text-orange-600">
                    {customer.phone} (Primary)
                  </a>
                </div>
              )}
              {customer.secondary_phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${customer.secondary_phone}`} className="hover:text-orange-600">
                    {customer.secondary_phone} (Secondary)
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="hover:text-orange-600">
                    {customer.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {customer.notes && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Notes</h3>
              <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">
                {customer.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle>Job History ({jobs.length})</CardTitle>
            <Link to={createPageUrl("Jobs") + "?action=new&customer_id=" + customer.id}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                New Job
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No jobs yet for this customer
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  to={createPageUrl("Jobs") + `?id=${job.id}`}
                  className="block p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">Job #{job.job_number}</h3>
                      <p className="text-sm text-slate-500 mt-1">{job.job_type_name}</p>
                    </div>
                    <Badge className={
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                      job.status === 'cancelled' ? 'bg-slate-100 text-slate-800' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.address}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}