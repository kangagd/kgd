
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail } from "lucide-react";
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
        <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
          <h3 className="font-bold text-[#000000] mb-3 flex items-center gap-2">
            Customer Information
          </h3>
          <div className="space-y-2">
            <div 
              className="font-bold text-lg text-[#000000] cursor-pointer hover:text-[#fae008] transition-colors"
              onClick={handleCustomerClick}
            >
              {project.customer_name}
            </div>
            {project.address && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{project.address}</span>
              </div>
            )}
            <div className="flex gap-3">
              {project.customer_phone && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.location.href = `tel:${project.customer_phone}`}
                  className="hover:bg-blue-100 text-slate-600 hover:text-blue-700"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call
                </Button>
              )}
              {project.customer_email && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.location.href = `mailto:${project.customer_email}`}
                  className="hover:bg-purple-100 text-slate-600 hover:text-purple-700"
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
            <p className="text-slate-700">{project.description}</p>
          </div>
        )}

        {(project.quote_value || project.invoice_value || project.payment_received) && (
          <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
            <h3 className="font-bold text-[#000000] mb-3">Financials</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {project.quote_value && (
                <div>
                  <div className="text-slate-600 font-medium">Quote</div>
                  <div className="text-lg font-bold text-[#000000]">${project.quote_value}</div>
                </div>
              )}
              {project.invoice_value && (
                <div>
                  <div className="text-slate-600 font-medium">Invoice</div>
                  <div className="text-lg font-bold text-[#000000]">${project.invoice_value}</div>
                </div>
              )}
              {project.payment_received && (
                <div>
                  <div className="text-slate-600 font-medium">Paid</div>
                  <div className="text-lg font-bold text-green-700">${project.payment_received}</div>
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
                  className="bg-white border-2 border-slate-200 rounded-xl p-4 hover:border-[#fae008] hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-[#000000]">Job #{job.job_number}</span>
                        <Badge className={`${jobStatusColors[job.status]} font-semibold border-2`}>
                          {job.status}
                        </Badge>
                        {job.job_type && (
                          <Badge variant="outline" className="font-semibold">
                            {job.job_type}
                          </Badge>
                        )}
                      </div>
                      {job.scheduled_date && (
                        <p className="text-sm text-slate-600">
                          {new Date(job.scheduled_date).toLocaleDateString()}
                          {job.scheduled_time && ` at ${job.scheduled_time}`}
                        </p>
                      )}
                    </div>
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
