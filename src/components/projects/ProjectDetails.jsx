import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon } from "lucide-react";
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

const statusColors = {
  open: "bg-slate-100 text-slate-800",
  scheduled: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  invoiced: "bg-indigo-100 text-indigo-800",
  paid: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-800"
};

const projectTypeColors = {
  "Garage Door Install": "bg-blue-100 text-blue-700",
  "Gate Install": "bg-green-100 text-green-700",
  "Roller Shutter Install": "bg-purple-100 text-purple-700",
  "Repair": "bg-orange-100 text-orange-700",
  "Maintenance": "bg-indigo-100 text-indigo-700"
};

const jobStatusColors = {
  open: "bg-slate-100 text-slate-800",
  scheduled: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  invoiced: "bg-indigo-100 text-indigo-800",
  paid: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-800"
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
    <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
      <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold text-[#000000] mb-2">{project.title}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {project.project_type && (
                  <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2`}>
                    {project.project_type}
                  </Badge>
                )}
                <Badge className={`${statusColors[project.status]} font-semibold border-2`}>
                  {project.status}
                </Badge>
                {project.stage && (
                  <Badge variant="outline" className="font-semibold border-2">
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
              className="border-2 hover:bg-slate-100"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-2 hover:bg-red-100 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This project will be moved to the archive. Associated jobs will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(project.id)}
                    className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="bg-[#F8F9FA] rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-[#111827] mb-3">Customer Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-[#E5E7EB] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[#111827]">{project.customer_name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#4B5563] font-medium mb-0.5">Customer</div>
                <div 
                  className="text-sm font-semibold text-[#111827] cursor-pointer hover:text-[#FAE008] transition-colors"
                  onClick={handleCustomerClick}
                >
                  {project.customer_name}
                </div>
                {customer?.customer_type && (
                  <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-2 py-0.5 rounded-lg mt-1">
                    {customer.customer_type}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#E5E7EB]">
              {project.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 text-[#4B5563] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Address</div>
                    <span className="text-sm text-[#111827] font-semibold">{project.address}</span>
                  </div>
                </div>
              )}
              
              {project.customer_phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-5 h-5 text-[#4B5563] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Phone</div>
                    <span className="text-sm text-[#111827] font-semibold">{project.customer_phone}</span>
                  </div>
                </div>
              )}
              
              {project.customer_email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="w-5 h-5 text-[#4B5563] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-0.5">Email</div>
                    <span className="text-sm text-[#111827] font-semibold">{project.customer_email}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-3 border-t border-[#E5E7EB]">
              {project.customer_phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = `tel:${project.customer_phone}`}
                  className="flex-1"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call
                </Button>
              )}
              {project.customer_email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = `mailto:${project.customer_email}`}
                  className="flex-1"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              )}
            </div>
          </div>
        </div>

        {project.description && (
          <div>
            <h3 className="font-bold text-[#000000] mb-2">Description</h3>
            <div 
              className="text-slate-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />
          </div>
        )}

        {isInstallType && project.doors && project.doors.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
            <h3 className="font-bold text-[#000000] mb-3">Installation Details</h3>
            <div className="space-y-3">
              {project.doors.map((door, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="font-semibold text-sm text-blue-900 mb-2">Door {idx + 1}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {door.height && (
                      <div>
                        <span className="text-slate-600">Height:</span>
                        <span className="ml-1 font-medium text-[#000000]">{door.height}</span>
                      </div>
                    )}
                    {door.width && (
                      <div>
                        <span className="text-slate-600">Width:</span>
                        <span className="ml-1 font-medium text-[#000000]">{door.width}</span>
                      </div>
                    )}
                    {door.type && (
                      <div>
                        <span className="text-slate-600">Type:</span>
                        <span className="ml-1 font-medium text-[#000000]">{door.type}</span>
                      </div>
                    )}
                    {door.style && (
                      <div>
                        <span className="text-slate-600">Style:</span>
                        <span className="ml-1 font-medium text-[#000000]">{door.style}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {((project.image_urls && project.image_urls.length > 0) || project.quote_url || project.invoice_url) && (
          <div>
            <h3 className="font-bold text-[#000000] mb-3">Attachments</h3>
            <div className="space-y-4">
              {project.image_urls && project.image_urls.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-700">Images</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
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
                          alt={`Project image ${index + 1}`} 
                          className="w-full h-24 object-cover rounded-lg border-2 border-slate-200 hover:border-[#fae008] transition-all"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(project.quote_url || project.invoice_url) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-700">Files</span>
                  </div>
                  <div className="space-y-2">
                    {project.quote_url && (
                      <a 
                        href={project.quote_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg hover:border-[#fae008] transition-all"
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
                        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg hover:border-[#fae008] transition-all"
                      >
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-slate-700">Invoice Document</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(project.quote_value || project.invoice_value || project.payment_received) && (
          <div className="bg-[#F8F9FA] rounded-lg p-4">
            <h3 className="font-bold text-[#111827] mb-4">Financials</h3>
            <div className="grid grid-cols-3 gap-6">
              {project.quote_value && (
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-1">Quote</div>
                    <div className="text-lg font-bold text-[#111827]">${project.quote_value}</div>
                  </div>
                </div>
              )}
              {project.invoice_value && (
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-1">Invoice</div>
                    <div className="text-lg font-bold text-[#111827]">${project.invoice_value}</div>
                  </div>
                </div>
              )}
              {project.payment_received && (
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#4B5563] font-medium mb-1">Paid</div>
                    <div className="text-lg font-bold text-[#16A34A]">${project.payment_received}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {project.assigned_technicians_names && project.assigned_technicians_names.length > 0 && (
          <div>
            <h3 className="font-bold text-[#000000] mb-2">Assigned Team</h3>
            <div className="flex gap-2 flex-wrap">
              {project.assigned_technicians_names.map((name, idx) => (
                <Badge key={idx} variant="outline" className="font-semibold">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {project.notes && (
          <div>
            <h3 className="font-bold text-[#000000] mb-2">Notes</h3>
            <div 
              className="text-slate-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: project.notes }}
            />
          </div>
        )}

        <div className="pt-4 border-t-2 border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#000000] text-lg">Jobs ({jobs.length})</h3>
            <Button
              onClick={handleAddJob}
              className="bg-[#fae008] text-[#000000] hover:bg-[#e5d007] font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Job
            </Button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
              <p className="text-slate-500 mb-3">No jobs yet</p>
              <Button onClick={handleAddJob} className="bg-[#fae008] text-[#000000] font-semibold">
                Create First Job
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => handleJobClick(job.id)}
                  className="bg-white border border-[#E5E7EB] rounded-lg p-4 hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="text-lg font-semibold text-[#111827]">
                      {job.customer_name}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-[#F2F4F7] text-[#344054] hover:bg-[#F2F4F7] border-0 font-medium text-sm px-3 py-1 rounded-lg">
                        #{job.job_number}
                      </Badge>
                      <Badge className={`${jobStatusColors[job.status]} hover:${jobStatusColors[job.status]} border-0 font-semibold text-xs px-3 py-1 rounded-lg`}>
                        {job.status}
                      </Badge>
                      {job.job_type_name && (
                        <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                          {job.job_type_name}
                        </Badge>
                      )}
                    </div>
                    
                    {job.scheduled_date && (
                      <p className="text-sm text-[#4B5563]">
                        {new Date(job.scheduled_date).toLocaleDateString()}
                        {job.scheduled_time && ` at ${job.scheduled_time}`}
                      </p>
                    )}
                    
                    {job.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#4B5563]" />
                        <span className="text-sm text-[#4B5563]">{job.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}