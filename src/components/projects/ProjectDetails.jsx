import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EditableField from "../jobs/EditableField";
import RichTextEditor from "../common/RichTextEditor";
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
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(project.description || "");
  const [notes, setNotes] = useState(project.notes || "");

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

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
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

  const handleFieldSave = (fieldName, oldValue, newValue) => {
    updateProjectMutation.mutate({ field: fieldName, value: newValue });
  };

  const handleDescriptionBlur = () => {
    if (description !== project.description) {
      updateProjectMutation.mutate({ field: 'description', value: description });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== project.notes) {
      updateProjectMutation.mutate({ field: 'notes', value: notes });
    }
  };

  const handleTechniciansChange = (emails) => {
    const emailsArray = Array.isArray(emails) ? emails : [];
    const techNames = emailsArray.map(email => {
      const tech = technicians.find(t => t.email === email);
      return tech?.full_name || "";
    }).filter(Boolean);
    updateProjectMutation.mutate({ field: 'assigned_technicians', value: emailsArray });
    updateProjectMutation.mutate({ field: 'assigned_technicians_names', value: techNames });
  };

  const isInstallType = project.project_type && project.project_type.includes("Install");

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
      <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 flex-shrink-0 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#111827]" />
          </Button>

          <div className="flex gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(project)}
              className="h-9 w-9 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827] transition-all rounded-lg"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-red-50 hover:text-red-600 transition-all rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600">
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

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              className="text-xl font-semibold text-[#111827] cursor-pointer hover:text-[#FAE008] transition-colors leading-tight"
              onClick={handleCustomerClick}
            >
              {project.customer_name}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <EditableField
              value={project.title}
              onSave={(val) => handleFieldSave('title', project.title, val)}
              type="text"
              placeholder="Project Title"
              className="font-medium text-[#111827]"
            />
            {project.project_type && (
              <EditableField
                value={project.project_type}
                onSave={(val) => handleFieldSave('project_type', project.project_type, val)}
                type="select"
                options={[
                  { value: "Garage Door Install", label: "Garage Door Install" },
                  { value: "Gate Install", label: "Gate Install" },
                  { value: "Roller Shutter Install", label: "Roller Shutter Install" },
                  { value: "Repair", label: "Repair" },
                  { value: "Maintenance", label: "Maintenance" }
                ]}
                displayFormat={(val) => (
                  <Badge className={`${projectTypeColors[val]} font-semibold border-0 px-2.5 py-0.5 rounded-lg text-xs`}>
                    {val}
                  </Badge>
                )}
              />
            )}
            <EditableField
              value={project.status}
              onSave={(val) => handleFieldSave('status', project.status, val)}
              type="select"
              options={[
                { value: "open", label: "Open" },
                { value: "scheduled", label: "Scheduled" },
                { value: "quoted", label: "Quoted" },
                { value: "invoiced", label: "Invoiced" },
                { value: "paid", label: "Paid" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" }
              ]}
              displayFormat={(val) => (
                <Badge className={`${statusColors[val]} font-semibold border-0 px-2.5 py-0.5 rounded-lg text-xs`}>
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </Badge>
              )}
            />
            {project.stage && (
              <EditableField
                value={project.stage}
                onSave={(val) => handleFieldSave('stage', project.stage, val)}
                type="select"
                options={[
                  { value: "lead_in", label: "Lead In" },
                  { value: "measure", label: "Measure" },
                  { value: "quote_prepared", label: "Quote Prepared" },
                  { value: "quote_sent", label: "Quote Sent" },
                  { value: "quote_accepted", label: "Quote Accepted" },
                  { value: "materials_ordered", label: "Materials Ordered" },
                  { value: "installation_scheduled", label: "Installation Scheduled" },
                  { value: "installation_completed", label: "Installation Completed" },
                  { value: "qa_aftercare", label: "QA Aftercare" },
                  { value: "final_invoice", label: "Final Invoice" },
                  { value: "project_closed", label: "Project Closed" },
                  { value: "diagnose", label: "Diagnose" },
                  { value: "repair_scheduled", label: "Repair Scheduled" },
                  { value: "repair_completed", label: "Repair Completed" },
                  { value: "maintenance_performed", label: "Maintenance Performed" },
                  { value: "report_delivered", label: "Report Delivered" }
                ]}
                displayFormat={(val) => {
                  const formatted = val.replace(/_/g, ' ');
                  return (
                    <Badge variant="outline" className="font-semibold border-[#E5E7EB] px-2.5 py-0.5 rounded-lg text-xs">
                      {formatted.charAt(0).toUpperCase() + formatted.slice(1)}
                    </Badge>
                  );
                }}
              />
            )}
            {customer?.customer_type && (
              <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold px-2.5 py-0.5 rounded-lg text-xs">
                {customer.customer_type}
              </Badge>
            )}
          </div>
        </div>

        <div className="bg-[#ffffff] p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-[#4B5563]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#4B5563] font-medium mb-0.5">Address</div>
                <EditableField
                  value={project.address}
                  onSave={(val) => handleFieldSave('address', project.address, val)}
                  type="text"
                  placeholder="Set address"
                  className="font-semibold text-[#111827] text-sm"
                />
              </div>
            </div>
            {project.customer_phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Phone</div>
                  <span className="font-semibold text-[#111827] text-sm">{project.customer_phone}</span>
                </div>
              </div>
            )}
            {project.customer_email && (
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#4B5563]" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#4B5563] font-medium mb-0.5">Email</div>
                  <span className="font-semibold text-[#111827] text-sm">{project.customer_email}</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5 col-span-3">
              <svg className="w-5 h-5 text-[#4B5563]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#4B5563] font-medium mb-0.5">Technicians</div>
                <EditableField
                  value={project.assigned_technicians || []}
                  onSave={handleTechniciansChange}
                  type="multi-select"
                  icon={Edit}
                  options={technicians.map((t) => ({ value: t.email, label: t.full_name }))}
                  displayFormat={(val) => {
                    const emailsToDisplay = Array.isArray(val) ? val : val ? [val] : [];
                    if (emailsToDisplay.length === 0) return "Assign";
                    const names = emailsToDisplay.map(email => {
                      const tech = technicians.find(t => t.email === email);
                      return tech?.full_name || email;
                    });
                    return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
                  }}
                  placeholder="Assign"
                  className="font-semibold text-[#111827] text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-4 space-y-3">
        <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#6B7280]" />
              <h3 className="text-sm font-bold text-[#111827]">Contact</h3>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex gap-2">
              {project.customer_phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = `tel:${project.customer_phone}`}
                  className="flex-1 h-10"
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
                  className="flex-1 h-10"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              <h3 className="text-sm font-bold text-[#111827]">Description</h3>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              onBlur={handleDescriptionBlur}
              placeholder="Add description..."
            />
          </CardContent>
        </Card>

        {isInstallType && project.doors && project.doors.length > 0 && (
          <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
            <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-sm font-bold text-[#111827]">Installation Details</h3>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-2">
                {project.doors.map((door, idx) => (
                  <Badge key={idx} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-medium px-3 py-1.5 text-sm">
                    Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                    {door.type && ` • ${door.type}`}
                    {door.style && ` • ${door.style}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {((project.image_urls && project.image_urls.length > 0) || project.quote_url || project.invoice_url) && (
          <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
            <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-sm font-bold text-[#111827]">Attachments</h3>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {project.image_urls && project.image_urls.length > 0 && (
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
                        className="w-full h-24 object-cover rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] transition-all"
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
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-[#111827]">Quote Document</span>
                    </a>
                  )}
                  {project.invoice_url && (
                    <a 
                      href={project.invoice_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all"
                    >
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-[#111827]">Invoice Document</span>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}



        <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              <h3 className="text-sm font-bold text-[#111827]">Notes</h3>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              onBlur={handleNotesBlur}
              placeholder="Add notes..."
            />
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden">
          <CardHeader className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-sm font-bold text-[#111827]">Jobs ({jobs.length})</h3>
              </div>
              <Button
                onClick={handleAddJob}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Job
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {jobs.length === 0 ? (
              <div className="text-center py-8 bg-[#F8F9FA] rounded-lg">
                <p className="text-[#6B7280] mb-3 text-sm">No jobs yet</p>
                <Button onClick={handleAddJob} className="bg-[#FAE008] text-[#111827] font-semibold h-10">
                  Create First Job
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => handleJobClick(job.id)}
                    className="bg-white border border-[#E5E7EB] rounded-lg p-3 hover:border-[#FAE008] hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
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
                          {job.scheduled_time && ` • ${job.scheduled_time}`}
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
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}