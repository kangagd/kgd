import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Phone, Mail, Briefcase, Plus, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-blue-100 text-blue-700 border-blue-200",
  "Real Estate - Tenant": "bg-green-100 text-green-700 border-green-200",
  "Strata - Owner": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function CustomerDetails({ customer, onClose, onEdit }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }, '-scheduled_date'),
  });

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <CardTitle className="text-2xl font-bold">{customer.name}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={customer.status === 'active' ? 
                  "bg-green-100 text-green-700" : 
                  "bg-slate-100 text-slate-700"
                }>
                  {customer.status}
                </Badge>
                {customer.customer_type && (
                  <Badge className={customerTypeColors[customer.customer_type]}>
                    <Tag className="w-3 h-3 mr-1" />
                    {customer.customer_type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => onEdit(customer)} className="bg-orange-600 hover:bg-orange-700">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-3">Contact Information</h3>
          <div className="space-y-3">
            {customer.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />
                <a href={`tel:${customer.phone}`} className="hover:text-orange-600">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.secondary_phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400" />
                <a href={`tel:${customer.secondary_phone}`} className="hover:text-orange-600">
                  {customer.secondary_phone} (secondary)
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
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Notes</h3>
            <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">
              {customer.notes}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Job History ({jobs.length})</h3>
            <Link to={createPageUrl("Jobs") + `?action=new&customer_id=${customer.id}`}>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                New Job
              </Button>
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No jobs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <Link 
                  key={job.id} 
                  to={createPageUrl("Jobs") + `?id=${job.id}`}
                  className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">Job #{job.job_number}</h4>
                      <p className="text-sm text-slate-500 mt-1">{job.address}</p>
                    </div>
                    <Badge className={
                      job.status === 'completed' ? 'bg-green-100 text-green-700' :
                      job.status === 'in_progress' ? 'bg-orange-100 text-orange-700' :
                      job.status === 'cancelled' ? 'bg-slate-100 text-slate-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600">
                    {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                    {job.scheduled_time && ` at ${job.scheduled_time}`}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}