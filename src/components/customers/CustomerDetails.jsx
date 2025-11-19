import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Phone, Mail, Briefcase, Plus, Tag, Trash2, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-blue-100 text-blue-700 border-blue-200",
  "Real Estate - Tenant": "bg-green-100 text-green-700 border-green-200",
  "Strata - Owner": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function CustomerDetails({ customer, onClose, onEdit, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  const { data: allJobs = [] } = useQuery({
    queryKey: ['customerJobs', customer.id],
    queryFn: () => base44.entities.Job.filter({ customer_id: customer.id }, '-scheduled_date'),
  });

  const { data: organisation } = useQuery({
    queryKey: ['organisation', customer.organisation_id],
    queryFn: () => base44.entities.Organisation.get(customer.organisation_id),
    enabled: !!customer.organisation_id
  });

  const jobs = allJobs.filter(job => !job.deleted_at);

  const handleDelete = () => {
    onDelete(customer.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200 rounded-xl">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">{customer.name}</CardTitle>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge className={customer.status === 'active' ? 
                    "bg-green-50 text-green-700 border-2 border-green-200 font-semibold" : 
                    "bg-slate-50 text-slate-700 border-2 border-slate-200 font-semibold"
                  }>
                    {customer.status}
                  </Badge>
                  {customer.customer_type && (
                    <Badge className={`${customerTypeColors[customer.customer_type]} border-2 font-semibold`}>
                      <Tag className="w-3 h-3 mr-1" />
                      {customer.customer_type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowDeleteConfirm(true)} 
                className="hover:bg-red-100 hover:text-red-600 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                onClick={() => onEdit(customer)} 
                className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold rounded-xl shadow-md"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          {organisation && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-blue-900 mb-2">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm font-bold">Organisation</span>
                  </div>
                  <h4 className="font-bold text-[#000000] text-lg mb-1">{organisation.name}</h4>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 border font-semibold text-xs">
                    {organisation.organisation_type}
                  </Badge>
                  {organisation.address && (
                    <p className="text-sm text-slate-700 mt-2">{organisation.address}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Organisations'))}
                  className="border-2 font-semibold"
                >
                  View
                </Button>
              </div>
            </div>
          )}

          <div className="bg-[#F8F9FA] rounded-lg p-4">
            <h3 className="text-sm font-bold text-[#111827] mb-3">Contact Information</h3>
            <div className="space-y-3">
              {customer.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="w-5 h-5 text-[#4B5563]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Phone</div>
                    <a href={`tel:${customer.phone}`} className="text-sm font-semibold text-[#111827] hover:text-[#FAE008] transition-colors">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.secondary_phone && (
                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E5E7EB]">
                  <Phone className="w-5 h-5 text-[#4B5563]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Secondary Phone</div>
                    <a href={`tel:${customer.secondary_phone}`} className="text-sm font-semibold text-[#111827] hover:text-[#FAE008] transition-colors">
                      {customer.secondary_phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E5E7EB]">
                  <Mail className="w-5 h-5 text-[#4B5563]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Email</div>
                    <a href={`mailto:${customer.email}`} className="text-sm font-semibold text-[#111827] hover:text-[#FAE008] transition-colors truncate block">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {customer.notes && (
            <div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Notes</h3>
              <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                {customer.notes}
              </p>
            </div>
          )}

          <div className="pt-4 border-t-2 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#000000]">Job History ({jobs.length})</h3>
              <Link to={createPageUrl("Jobs") + `?action=new&customer_id=${customer.id}`}>
                <Button size="sm" variant="outline" className="border-2 font-semibold hover:bg-slate-100 rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  New Job
                </Button>
              </Link>
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Link 
                    key={job.id} 
                    to={createPageUrl("Jobs") + `?id=${job.id}`}
                    className="block p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-[#fae008] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-[#000000] tracking-tight">Job #{job.job_number}</h4>
                        <p className="text-sm text-slate-600 mt-1 font-medium">{job.address}</p>
                      </div>
                      <Badge className={
                        job.status === 'completed' ? 'bg-green-50 text-green-700 border-2 border-green-200' :
                        job.status === 'in_progress' ? 'bg-orange-50 text-orange-700 border-2 border-orange-200' :
                        job.status === 'cancelled' ? 'bg-slate-50 text-slate-700 border-2 border-slate-200' :
                        'bg-blue-50 text-blue-700 border-2 border-blue-200'
                      }>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This customer will be moved to the archive. You can restore them within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}