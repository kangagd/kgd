import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit2, Trash2, MapPin, Phone, Mail, User, Calendar, Plus, Briefcase } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const projectTypeColors = {
  "Installation": "bg-blue-100 text-blue-700 border-blue-200",
  "Repair": "bg-orange-100 text-orange-700 border-orange-200",
  "Maintenance": "bg-green-100 text-green-700 border-green-200",
  "Quote": "bg-purple-100 text-purple-700 border-purple-200",
  "Service": "bg-amber-100 text-amber-700 border-amber-200",
};

const statusColors = {
  "in_progress": "bg-blue-100 text-blue-800 border-blue-200",
  "awaiting_parts": "bg-amber-100 text-amber-800 border-amber-200",
  "scheduled": "bg-purple-100 text-purple-800 border-purple-200",
  "completed": "bg-green-100 text-green-800 border-green-200",
  "cancelled": "bg-slate-100 text-slate-800 border-slate-200",
  "on_hold": "bg-red-100 text-red-800 border-red-200",
};

const stageColors = {
  "measure": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "quote": "bg-purple-100 text-purple-700 border-purple-200",
  "approval": "bg-amber-100 text-amber-700 border-amber-200",
  "install": "bg-blue-100 text-blue-700 border-blue-200",
  "complete": "bg-green-100 text-green-700 border-green-200",
};

const jobStatusColors = {
  open: "bg-slate-100 text-slate-800 border-slate-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function ProjectDetails({ project, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();

  const { data: projectJobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: () => base44.entities.Job.filter({ project_id: project.id, deleted_at: { $exists: false } }, '-scheduled_date')
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', project.customer_id],
    queryFn: () => base44.entities.Customer.get(project.customer_id),
    enabled: !!project.customer_id
  });

  const handleAddVisit = () => {
    navigate(createPageUrl('Jobs') + `?projectId=${project.id}&customerId=${project.customer_id}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 flex-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
                    {project.name}
                  </CardTitle>
                  {project.project_type && (
                    <Badge className={`${projectTypeColors[project.project_type]} font-semibold border-2`}>
                      {project.project_type}
                    </Badge>
                  )}
                  {project.status && (
                    <Badge className={`${statusColors[project.status]} font-semibold border-2`}>
                      {project.status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  {project.stage && (
                    <Badge className={`${stageColors[project.stage]} font-semibold border-2`}>
                      Stage: {project.stage}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="border-2 hover:bg-slate-100 font-semibold"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-2 hover:bg-red-100 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will archive the project and all its visits. You can restore it within 30 days.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-2 font-semibold">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-red-600 hover:bg-red-700 font-semibold"
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
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
                  <User className="w-4 h-4" />
                  <span>Customer</span>
                </div>
                <p 
                  className="text-[#000000] font-bold text-lg cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => navigate(createPageUrl('Customers') + `?customerId=${project.customer_id}`)}
                >
                  {project.customer_name}
                </p>
                {customer?.phone && (
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />
                    {customer.phone}
                  </a>
                )}
                {customer?.email && (
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3" />
                    {customer.email}
                  </a>
                )}
              </div>

              {project.address && (
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
                    <MapPin className="w-4 h-4" />
                    <span>Address</span>
                  </div>
                  <p className="text-[#000000] font-medium">{project.address}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {project.start_date && (
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Start Date</span>
                  </div>
                  <p className="text-[#000000] font-medium">{format(parseISO(project.start_date), 'MMMM d, yyyy')}</p>
                </div>
              )}

              {project.target_completion_date && (
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Target Completion</span>
                  </div>
                  <p className="text-[#000000] font-medium">{format(parseISO(project.target_completion_date), 'MMMM d, yyyy')}</p>
                </div>
              )}

              {project.actual_completion_date && (
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Completed</span>
                  </div>
                  <p className="text-[#000000] font-medium">{format(parseISO(project.actual_completion_date), 'MMMM d, yyyy')}</p>
                </div>
              )}
            </div>
          </div>

          {project.description && (
            <div className="pt-4 border-t-2 border-slate-200">
              <h3 className="text-sm font-bold text-slate-500 mb-2">Description</h3>
              <p className="text-slate-700">{project.description}</p>
            </div>
          )}

          {project.notes && (
            <div className="pt-4 border-t-2 border-slate-200">
              <h3 className="text-sm font-bold text-slate-500 mb-2">Notes</h3>
              <p className="text-slate-700 whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}

          {project.assigned_technicians_names && project.assigned_technicians_names.length > 0 && (
            <div className="pt-4 border-t-2 border-slate-200">
              <h3 className="text-sm font-bold text-slate-500 mb-2">Assigned Technicians</h3>
              <div className="flex flex-wrap gap-2">
                {project.assigned_technicians_names.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t-2 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#000000] tracking-tight flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Visits ({projectJobs.length})
              </h3>
              <Button
                onClick={handleAddVisit}
                size="sm"
                className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Visit
              </Button>
            </div>

            {projectJobs.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
                <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 mb-3">No visits scheduled yet</p>
                <Button
                  onClick={handleAddVisit}
                  variant="outline"
                  className="border-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule First Visit
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {projectJobs.map((job, index) => (
                  <Card
                    key={job.id}
                    className="hover:shadow-md transition-all cursor-pointer border-2 border-slate-200 rounded-xl"
                    onClick={() => navigate(createPageUrl('Jobs') + `?jobId=${job.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-500">Visit #{projectJobs.length - index}</span>
                            <Badge className={`${jobStatusColors[job.status]} text-xs font-semibold border-2`}>
                              {job.status.replace(/_/g, ' ')}
                            </Badge>
                            {job.job_type_name && (
                              <Badge variant="outline" className="text-xs">
                                {job.job_type_name}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span className="font-semibold text-[#000000]">
                                {format(parseISO(job.scheduled_date), 'MMMM d, yyyy')}
                                {job.scheduled_time && ` at ${job.scheduled_time}`}
                              </span>
                            </div>
                            {job.assigned_to_name && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(', ') : job.assigned_to_name}</span>
                              </div>
                            )}
                            {job.notes && (
                              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{job.notes.replace(/<[^>]*>/g, '')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}