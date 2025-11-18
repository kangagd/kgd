import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Phone, Mail, Briefcase, Plus, Tag, Trash2, Building2, MapPin } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const customerTypeColors = {
  "Owner": "bg-purple-500/10 text-purple-800 border-purple-500/20",
  "Builder": "bg-blue-500/10 text-blue-800 border-blue-500/20",
  "Real Estate - Tenant": "bg-green-500/10 text-green-800 border-green-500/20",
  "Strata - Owner": "bg-amber-500/10 text-amber-800 border-amber-500/20",
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
      <div className="p-4 space-y-3">
        {/* Header Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100 h-9 w-9 flex-shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-semibold text-slate-900 mb-2">{customer.name}</h1>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={customer.status === 'active' ? 
                      "bg-green-500/10 text-green-700 border-green-500/20 rounded-full px-2.5 py-0.5 text-xs font-medium border" : 
                      "bg-gray-500/10 text-gray-700 border-gray-500/20 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                    }>
                      {customer.status}
                    </Badge>
                    {customer.customer_type && (
                      <Badge className={`${customerTypeColors[customer.customer_type]} rounded-full px-2.5 py-0.5 text-xs font-medium border`}>
                        {customer.customer_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="hover:bg-red-50 hover:text-red-600 h-9 w-9"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => onEdit(customer)} 
                  className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-9 px-4 rounded-lg"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organisation Card */}
        {organisation && (
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Organisation</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-base text-slate-900 mb-1">{organisation.name}</h4>
                  <Badge className="bg-blue-500/10 text-blue-800 border-blue-500/20 rounded-full px-2 py-0.5 text-xs font-medium border mb-2">
                    {organisation.organisation_type}
                  </Badge>
                  {organisation.address && (
                    <p className="text-sm text-slate-600 mt-1">{organisation.address}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Organisations'))}
                  className="border-slate-300 hover:bg-slate-50 h-8 px-3 font-medium rounded-lg"
                >
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contact</span>
            </div>
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <a href={`tel:${customer.phone}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.secondary_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <a href={`tel:${customer.secondary_phone}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors">
                    {customer.secondary_phone} <span className="text-slate-400">(secondary)</span>
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <a href={`mailto:${customer.email}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-2 text-sm pt-1">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span className="text-slate-700">{customer.address}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        {customer.notes && (
          <Collapsible defaultOpen={false}>
            <Card className="shadow-sm border border-slate-200">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Jobs Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Jobs ({jobs.length})</span>
              </div>
              <Link to={createPageUrl("Jobs") + `?action=new&customer_id=${customer.id}`}>
                <Button size="sm" variant="outline" className="border-slate-300 hover:bg-slate-50 h-8 px-3 font-medium rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New Job
                </Button>
              </Link>
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <Briefcase className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link 
                    key={job.id} 
                    to={createPageUrl("Jobs") + `?id=${job.id}`}
                    className="block p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-900">#{job.job_number}</span>
                        <p className="text-xs text-slate-600 mt-0.5">{job.address}</p>
                      </div>
                      <Badge className={`${
                        job.status === 'completed' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                        job.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' :
                        job.status === 'cancelled' ? 'bg-gray-500/10 text-gray-700 border-gray-500/20' :
                        'bg-blue-500/10 text-blue-700 border-blue-500/20'
                      } rounded-full px-2 py-0.5 text-xs font-medium border`}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {job.scheduled_date && (
                      <div className="text-xs text-slate-500">
                        {format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                        {job.scheduled_time && ` at ${job.scheduled_time}`}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-lg border border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              This customer will be moved to the archive. You can restore them within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-medium border-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 rounded-lg font-medium"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}