
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, DollarSign, Users, Package, Briefcase } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import JobVisitCard from "./JobVisitCard";

const statusColors = {
  open: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  scheduled: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  quoted: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  invoiced: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-700 border-gray-500/20"
};

const projectTypeColors = {
  "Garage Door Install": "bg-yellow-500/10 text-yellow-800 border-yellow-500/20",
  "Gate Install": "bg-green-500/10 text-green-800 border-green-500/20",
  "Roller Shutter Install": "bg-purple-500/10 text-purple-800 border-purple-500/20",
  "Repair": "bg-orange-500/10 text-orange-800 border-orange-500/20",
  "Maintenance": "bg-indigo-500/10 text-indigo-800 border-indigo-500/20"
};

const jobStatusColors = {
  open: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  scheduled: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-700 border-gray-500/20"
};

export default function ProjectDetails({ project, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();

  const { data: projectJobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: () => base44.entities.Job.filter({ project_id: project.id })
  });

  const jobs = projectJobs.filter(j => !j.deleted_at);

  const { data: customer } = useQuery({
    queryKey: ['customer', project.customer_id],
    queryFn: () => base44.entities.Customer.get(project.customer_id),
    enabled: !!project.customer_id
  });

  const { data: allJobSummaries = [] } = useQuery({
    queryKey: ['projectJobSummaries', project.id],
    queryFn: async () => {
      const jobIds = jobs.map(j => j.id);
      if (jobIds.length === 0) return [];
      
      const summaries = await Promise.all(
        jobIds.map(jobId => base44.entities.JobSummary.filter({ job_id: jobId }, '-checkout_time'))
      );
      return summaries.flat();
    },
    enabled: jobs.length > 0
  });

  const getJobSummaries = (jobId) => {
    return allJobSummaries.filter(s => s.job_id === jobId);
  };

  const handleAddJob = () => {
    navigate(createPageUrl("Jobs") + `?action=new&projectId=${project.id}`);
  };

  const handleJobClick = (jobId) => {
    navigate(createPageUrl("Jobs") + `?jobId=${jobId}`);
  };

  const handleCustomerClick = () => {
    if (customer) {
      navigate(createPageUrl("Customers") + `?customerId=${customer.id}`);
    }
  };

  const isInstallType = project.project_type && project.project_type.includes("Install");

  return (
    <div className="p-4 space-y-3">
      {/* Header Card */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="hover:bg-slate-100 transition-colors flex-shrink-0 h-9 w-9"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-slate-900 mb-2 truncate">{project.title}</h1>
                <div className="flex gap-2 flex-wrap">
                  {project.project_type && (
                    <Badge className={`${projectTypeColors[project.project_type]} rounded-full px-3 py-1 text-xs font-medium border`}>
                      {project.project_type}
                    </Badge>
                  )}
                  <Badge className={`${statusColors[project.status]} rounded-full px-3 py-1 text-xs font-medium border`}>
                    {project.status}
                  </Badge>
                  {project.stage && (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium border-slate-300">
                      {project.stage.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(project)}
                className="border-slate-300 hover:bg-slate-50 h-9 w-9"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-300 hover:bg-red-50 hover:text-red-600 h-9 w-9"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-lg border border-slate-200">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-semibold">Delete Project?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-slate-600">
                      This project will be moved to the archive. Associated jobs will not be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg font-medium border-slate-300">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(project.id)}
                      className="bg-red-600 hover:bg-red-700 rounded-lg font-medium"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Card */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Customer</span>
          </div>
          <div 
            className="font-semibold text-base text-slate-900 cursor-pointer hover:text-[#fae008] transition-colors"
            onClick={handleCustomerClick}
          >
            {project.customer_name}
          </div>
          {project.address && (
            <div className="flex items-start gap-2 text-sm text-slate-600 pt-1">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
              <span>{project.address}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {project.customer_phone && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = `tel:${project.customer_phone}`}
                className="h-8 px-3 hover:bg-slate-100 text-slate-700 text-sm font-medium"
              >
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                Call
              </Button>
            )}
            {project.customer_email && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.location.href = `mailto:${project.customer_email}`}
                className="h-8 px-3 hover:bg-slate-100 text-slate-700 text-sm font-medium"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {project.description && (
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</span>
            </div>
            <div 
              className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />
          </CardContent>
        </Card>
      )}

      {/* Installation Details */}
      {isInstallType && project.doors && project.doors.length > 0 && (
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Installation Details</span>
            </div>
            <div className="space-y-2">
              {project.doors.map((door, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Door {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {door.height && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Height</span>
                        <span className="font-medium text-slate-900">{door.height}</span>
                      </div>
                    )}
                    {door.width && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Width</span>
                        <span className="font-medium text-slate-900">{door.width}</span>
                      </div>
                    )}
                    {door.type && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Type</span>
                        <span className="font-medium text-slate-900">{door.type}</span>
                      </div>
                    )}
                    {door.style && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Style</span>
                        <span className="font-medium text-slate-900">{door.style}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financials */}
      {(project.quote_value || project.invoice_value || project.payment_received) && (
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Financials</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {project.quote_value && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Quote</div>
                  <div className="text-lg font-semibold text-slate-900">${project.quote_value}</div>
                </div>
              )}
              {project.invoice_value && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Invoice</div>
                  <div className="text-lg font-semibold text-slate-900">${project.invoice_value}</div>
                </div>
              )}
              {project.payment_received && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Paid</div>
                  <div className="text-lg font-semibold text-green-700">${project.payment_received}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {((project.image_urls && project.image_urls.length > 0) || project.quote_url || project.invoice_url) && (
        <Collapsible defaultOpen={false}>
          <Card className="shadow-sm border border-slate-200">
            <CollapsibleTrigger className="w-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Attachments</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 pt-0 space-y-3">
                {project.image_urls && project.image_urls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {project.image_urls.map((url, index) => (
                      <a 
                        key={index} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img 
                          src={url} 
                          alt={`Project ${index + 1}`} 
                          className="w-full h-20 object-cover rounded border border-slate-200 hover:border-slate-400 transition-all"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {(project.quote_url || project.invoice_url) && (
                  <div className="space-y-2">
                    {project.quote_url && (
                      <a 
                        href={project.quote_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-slate-700">Quote Document</span>
                      </a>
                    )}
                    {project.invoice_url && (
                      <a 
                        href={project.invoice_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-slate-700">Invoice Document</span>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Notes */}
      {project.notes && (
        <Collapsible defaultOpen={false}>
          <Card className="shadow-sm border border-slate-200">
            <CollapsibleTrigger className="w-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 pt-0">
                <div 
                  className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: project.notes }}
                />
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
            <Button
              onClick={handleAddJob}
              size="sm"
              className="bg-[#fae008] text-slate-900 hover:bg-[#e5d007] font-medium h-8 px-3 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Job
            </Button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500 mb-3">No jobs yet</p>
              <Button onClick={handleAddJob} size="sm" className="bg-[#fae008] text-slate-900 font-medium h-8 px-3 rounded-lg">
                Create First Job
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const jobSummaries = getJobSummaries(job.id);
                return (
                  <div
                    key={job.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-all"
                  >
                    <div 
                      onClick={() => handleJobClick(job.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">#{job.job_number}</span>
                          {job.job_type_name && (
                            <span className="text-xs text-slate-500">{job.job_type_name}</span>
                          )}
                        </div>
                        <Badge className={`${jobStatusColors[job.status]} rounded-full px-2.5 py-0.5 text-xs font-medium border`}>
                          {job.status}
                        </Badge>
                      </div>
                      {job.scheduled_date && (
                        <p className="text-xs text-slate-500">
                          {new Date(job.scheduled_date).toLocaleDateString()}
                          {job.scheduled_time && ` at ${job.scheduled_time}`}
                        </p>
                      )}
                    </div>
                    
                    <JobVisitCard 
                      jobSummaries={jobSummaries}
                      jobImages={job.image_urls}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
