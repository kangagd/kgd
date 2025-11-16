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
  "Owner": "bg-purple-50 text-purple-900 border-purple-200 border-2",
  "Builder": "bg-blue-50 text-blue-900 border-blue-200 border-2",
  "Real Estate - Tenant": "bg-green-50 text-green-900 border-green-200 border-2",
  "Strata - Owner": "bg-amber-50 text-amber-900 border-amber-200 border-2",
};

export default function CustomerDetails({ customer, onClose, onEdit }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }, '-scheduled_date'),
  });

  return (
    <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
      <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">{customer.name}</CardTitle>
              <div className="flex gap-2 mt-3">
                <Badge className={customer.status === 'active' ? 
                  "bg-green-50 text-green-900 border-green-200 border-2 font-semibold" : 
                  "bg-slate-50 text-slate-900 border-slate-200 border-2 font-semibold"
                }>
                  {customer.status}
                </Badge>
                {customer.customer_type && (
                  <Badge className={`${customerTypeColors[customer.customer_type]} font-semibold`}>
                    <Tag className="w-3 h-3 mr-1.5" />
                    {customer.customer_type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => onEdit(customer)} className="bg-[#fae008] text-[#000000] hover:bg-[#e5d007] font-semibold shadow-md hover:shadow-lg transition-all rounded-xl">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-[#000000] mb-4 tracking-tight uppercase">Contact Information</h3>
          <div className="space-y-3">
            {customer.phone && (
              <div className="flex items-center gap-3 text-slate-700">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-600" />
                </div>
                <a href={`tel:${customer.phone}`} className="hover:text-[#fae008] font-medium transition-colors">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.secondary_phone && (
              <div className="flex items-center gap-3 text-slate-700">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-600" />
                </div>
                <a href={`tel:${customer.secondary_phone}`} className="hover:text-[#fae008] font-medium transition-colors">
                  {customer.secondary_phone} <span className="text-slate-500">(secondary)</span>
                </a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3 text-slate-700">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-slate-600" />
                </div>
                <a href={`mailto:${customer.email}`} className="hover:text-[#fae008] font-medium transition-colors">
                  {customer.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {customer.notes && (
          <div>
            <h3 className="text-sm font-bold text-[#000000] mb-3 tracking-tight uppercase">Notes</h3>
            <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border-2 border-slate-200 leading-relaxed">
              {customer.notes}
            </p>
          </div>
        )}

        <div className="pt-5 border-t-2 border-slate-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-[#000000] tracking-tight uppercase">Job History ({jobs.length})</h3>
            <Link to={createPageUrl("Jobs") + `?action=new&customer_id=${customer.id}`}>
              <Button size="sm" variant="outline" className="border-2 font-semibold hover:bg-slate-100 transition-all rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                New Job
              </Button>
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="font-semibold">No jobs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <Link 
                  key={job.id} 
                  to={createPageUrl("Jobs") + `?id=${job.id}`}
                  className="block p-4 bg-slate-50 rounded-xl hover:bg-slate-100 hover:shadow-md border-2 border-slate-200 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-[#000000]">Job #{job.job_number}</h4>
                      <p className="text-sm text-slate-600 mt-1 font-medium">{job.address}</p>
                    </div>
                    <Badge className={
                      job.status === 'completed' ? 'bg-green-50 text-green-900 border-green-200 border-2' :
                      job.status === 'in_progress' ? 'bg-orange-50 text-orange-900 border-orange-200 border-2' :
                      job.status === 'cancelled' ? 'bg-slate-50 text-slate-900 border-slate-200 border-2' :
                      'bg-blue-50 text-blue-900 border-blue-200 border-2'
                    }>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">
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