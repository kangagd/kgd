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
  "Owner": "bg-purple-50 text-purple-700 border-purple-200",
  "Builder": "bg-blue-50 text-blue-700 border-blue-200",
  "Real Estate - Tenant": "bg-green-50 text-green-700 border-green-200",
  "Strata - Owner": "bg-amber-50 text-amber-700 border-amber-200",
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
      <div className="p-2 md:p-4 space-y-2 md:space-y-3">
        {/* Header Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-start justify-between gap-3 md:gap-4">
              <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-100 h-8 w-8 md:h-9 md:w-9 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg md:text-xl font-semibold text-slate-900 mb-1.5 md:mb-2">{customer.name}</h1>
                  <div className="flex gap-1.5 md:gap-2 flex-wrap">
                    <Badge className={customer.status === 'active' ? 
                      "bg-green-50 text-green-700 border-green-200 rounded-lg px-2 py-1 text-xs font-semibold border-2" : 
                      "bg-gray-50 text-gray-700 border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold border-2"
                    }>
                      {customer.status}
                    </Badge>
                    {customer.customer_type && (
                      <Badge className={`${customerTypeColors[customer.customer_type]} rounded-lg px-2 py-1 text-xs font-semibold border-2`}>
                        {customer.customer_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="hover:bg-red-50 hover:text-red-600 h-8 w-8 md:h-9 md:w-9"
                >
                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
                <Button 
                  onClick={() => onEdit(customer)} 
                  className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900 font-medium h-8 md:h-9 px-3 md:px-4 rounded-lg text-sm"
                >
                  <Edit className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organisation Card */}
        {organisation && (
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Organisation</span>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm md:text-base text-slate-900 mb-1">{organisation.name}</h4>
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 rounded-lg px-2 py-1 text-xs font-semibold border-2 mb-1.5 md:mb-2">
                    {organisation.organisation_type}
                  </Badge>
                  {organisation.address && (
                    <p className="text-xs md:text-sm text-slate-600 mt-1">{organisation.address}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Organisations'))}
                  className="border-slate-300 hover:bg-slate-50 h-7 md:h-8 px-2.5 md:px-3 font-medium rounded-lg text-xs"
                >
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-3 md:p-4 space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
              <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
              <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Contact</span>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  <a href={`tel:${customer.phone}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.secondary_phone && (
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  <a href={`tel:${customer.secondary_phone}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors">
                    {customer.secondary_phone} <span className="text-slate-400">(secondary)</span>
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  <a href={`mailto:${customer.email}`} className="text-slate-700 hover:text-[#fae008] font-medium transition-colors truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm pt-0.5 md:pt-1">
                  <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
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
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-0">
                  <p className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Jobs Card */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Jobs ({jobs.length})</span>
              </div>
              <Link to={createPageUrl("Jobs") + `?action=new&customer_id=${customer.id}`}>
                <Button size="sm" variant="outline" className="border-slate-300 hover:bg-slate-50 h-7 md:h-8 px-2.5 md:px-3 font-medium rounded-lg text-xs">
                  <Plus className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
                  New Job
                </Button>
              </Link>
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-6 md:py-8 bg-slate-50 rounded-lg border border-slate-200">
                <Briefcase className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-1.5 md:mb-2 text-slate-300" />
                <p className="text-xs md:text-sm text-slate-500">No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-1.5 md:space-y-2">
                {jobs.map((job) => (
                  <Link 
                    key={job.id} 
                    to={createPageUrl("Jobs") + `?id=${job.id}`}
                    className="block p-2.5 md:p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-0.5 md:mb-1">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs md:text-sm font-semibold text-slate-900">#{job.job_number}</span>
                        <p className="text-[10px] md:text-xs text-slate-600 mt-0.5">{job.address}</p>
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
                      <div className="text-[10px] md:text-xs text-slate-500">
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
            <AlertDialogTitle className="text-base md:text-lg font-semibold">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-sm text-slate-600">
              This customer will be moved to the archive. You can restore them within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-medium border-slate-300 text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 rounded-lg font-medium text-sm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}