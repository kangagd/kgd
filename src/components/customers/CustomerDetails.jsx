import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Phone, Mail, Briefcase, Plus, Tag, Trash2, Building2, MapPin, Users, FolderKanban } from "lucide-react";
import { StatusBadge, CustomerTypeBadge, JobStatusBadge, ProjectStatusBadge } from "../common/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import DuplicateWarningCard, { DuplicateBadge } from "../common/DuplicateWarningCard";
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
import TasksPanel from "../tasks/TasksPanel";
import { Badge } from "@/components/ui/badge";
import BackButton from "../common/BackButton";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";

export default function CustomerDetails({ customer, onClose, onEdit, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        // Error loading user
      }
    };
    loadUser();
  }, []);

  const { data: jobs = [] } = useQuery({
    queryKey: ['customerJobs', customer.id],
    queryFn: async () => {
      const allJobs = await base44.entities.Job.filter({ customer_id: customer.id }, '-scheduled_date');
      return allJobs.filter(job => !job.deleted_at);
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['customerProjects', customer.id],
    queryFn: async () => {
      const allProjects = await base44.entities.Project.filter({ customer_id: customer.id }, '-created_date');
      return allProjects.filter(project => !project.deleted_at);
    },
  });

  const { data: organisation } = useQuery({
    queryKey: ['organisation', customer.organisation_id],
    queryFn: () => base44.entities.Organisation.get(customer.organisation_id),
    enabled: !!customer.organisation_id
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', customer.contract_id],
    queryFn: () => base44.entities.Contract.get(customer.contract_id),
    enabled: !!customer.contract_id
  });

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
              <BackButton onClick={onClose} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">{customer.name}</CardTitle>
                  <DuplicateBadge record={customer} />
                  {customer.is_station && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 border font-medium text-[12px] leading-[1.35]">
                      Station
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <StatusBadge type="status" value={customer.status} />
                  {customer.customer_type && (
                    <CustomerTypeBadge value={customer.customer_type}>
                      <Tag className="w-3 h-3 mr-1" />
                      {customer.customer_type}
                    </CustomerTypeBadge>
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
          {/* Attention Items Panel */}
          <AttentionItemsPanel
            entity_type="customer"
            entity_id={customer.id}
            context_ids={{
              customer_id: customer.id,
              project_id: null,
              job_id: null
            }}
          />

          {/* Duplicate Warning */}
          <DuplicateWarningCard entityType="Customer" record={customer} />

          {/* Contract Banner */}
          {contract && (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-1">Linked Contract</div>
                <h3 className="text-lg font-bold text-purple-900">{contract.name}</h3>
                <p className="text-sm text-purple-800">{contract.contract_type}</p>
                </div>
                <Link to={createPageUrl("Contracts") + `?contractId=${contract.id}`}>
                <Button variant="outline" className="bg-white text-purple-700 border-purple-200 hover:bg-purple-50">
                  View Contract
                </Button>
                </Link>
            </div>
          )}

          {organisation && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-blue-900 mb-2">
                    <Building2 className="w-4 h-4" />
                    <span className="text-[14px] font-semibold leading-[1.4]">Organisation</span>
                  </div>
                  <h4 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-1">{organisation.name}</h4>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 border font-medium text-[12px] leading-[1.35]">
                    {organisation.organisation_type}
                  </Badge>
                  {organisation.address && (
                    <p className="text-[14px] text-slate-700 leading-[1.4] mt-2">{organisation.address}</p>
                  )}
                </div>
                <Link to={createPageUrl('Organisations') + `?organisationId=${organisation.id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-2 font-semibold"
                  >
                    View
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <h3 className="text-[14px] font-semibold text-[#111827] leading-[1.4] mb-4">Contact Information</h3>
            <div className="space-y-5">
              {(customer.address_full || customer.address) && (
                <div className="flex items-start gap-3">
                  <MapPin className="text-green-600 w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-sm font-medium text-[#6B7280]">Address</div>
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address_full || customer.address)}`, '_blank')}
                      className="text-base text-[#111827] leading-normal hover:text-green-600 transition-colors text-left break-words"
                    >
                      {customer.address_full || customer.address}
                    </button>
                  </div>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="text-blue-600 w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-sm font-medium text-[#6B7280]">Phone</div>
                    <a href={`tel:${customer.phone}`} className="text-base text-[#111827] leading-normal hover:text-blue-600 transition-colors">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              
              {customer.secondary_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="text-blue-600 w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-sm font-medium text-[#6B7280]">Secondary Phone</div>
                    <a href={`tel:${customer.secondary_phone}`} className="text-base text-[#111827] leading-normal hover:text-blue-600 transition-colors">
                      {customer.secondary_phone}
                    </a>
                  </div>
                </div>
              )}
              
              {customer.email && (
                <div className="flex items-start gap-3">
                  <Mail className="text-purple-600 w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-sm font-medium text-[#6B7280]">Email</div>
                    <a href={`mailto:${customer.email}`} className="text-base text-[#111827] leading-normal hover:text-purple-600 transition-colors break-all">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {customer.source && (
            <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
              <h3 className="text-[14px] font-semibold text-[#111827] leading-[1.4] mb-4">Source</h3>
              <div className="flex items-start gap-3">
                <Users className="text-indigo-600 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="text-base text-[#111827] leading-normal">
                    {customer.source}
                  </div>
                  {customer.source_details && (
                    <div className="text-sm text-[#6B7280]">
                      {customer.source === "Word of mouth" ? "Referred by: " : ""}
                      {customer.source_details}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {customer.notes && (
            <div>
              <h3 className="text-[14px] font-semibold text-[#111827] leading-[1.4] mb-2">Notes</h3>
              <div className="text-[14px] text-slate-700 leading-[1.4] whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                {customer.notes}
              </div>
            </div>
          )}

          {/* Tasks Panel */}
          <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
            <TasksPanel
              entityType="customer"
              entityId={customer.id}
              entityName={customer.name}
            />
          </div>

          <div className="pt-4 border-t-2 border-slate-200 space-y-6">
            {/* Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Projects ({projects.length})</h3>
                <Link to={createPageUrl("Projects") + `?action=create&customer_id=${customer.id}`}>
                  <Button size="sm" variant="outline" className="border-2 font-semibold hover:bg-slate-100 rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </Link>
              </div>

              {projects.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FolderKanban className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-[14px] font-normal leading-[1.4]">No projects yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <Link 
                      key={project.id} 
                      to={createPageUrl("Projects") + `?projectId=${project.id}`}
                      className="block p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-[#fae008] hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[16px] font-medium text-[#111827] leading-[1.4]">{project.title}</h4>
                          <p className="text-[14px] text-slate-600 leading-[1.4] mt-1 font-normal">{project.address_full || project.address}</p>
                        </div>
                        <ProjectStatusBadge value={project.status} />
                      </div>
                      {project.project_type && (
                        <div className="text-[12px] text-slate-600 leading-[1.35] font-normal">
                          {project.project_type}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Jobs Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">Jobs ({jobs.length})</h3>
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
                  <p className="text-[14px] font-normal leading-[1.4]">No jobs yet</p>
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
                          <h4 className="text-[16px] font-medium text-[#111827] leading-[1.4]">Job #{job.job_number}</h4>
                          <p className="text-[14px] text-slate-600 leading-[1.4] mt-1 font-normal">{job.address}</p>
                        </div>
                        <JobStatusBadge value={job.status} />
                      </div>
                      <div className="text-[12px] text-slate-600 leading-[1.35] font-normal">
                        {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                        {job.scheduled_time && ` at ${job.scheduled_time}`}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-slate-600 leading-[1.4]">
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