import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Phone, Mail, FileText, Image as ImageIcon, DollarSign, Users, Package, Briefcase, MoreVertical, Calendar, User as UserIcon, Download, Eye, ClipboardList, Activity, Clock } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import JobVisitCard from "./JobVisitCard";

export default function ProjectDetails({ project, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const tabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "jobs", label: "Jobs", icon: Briefcase, count: jobs.length },
    { id: "installation", label: "Installation", icon: Package, show: isInstallType && project.doors?.length > 0 },
    { id: "attachments", label: "Attachments", icon: ImageIcon, show: (project.image_urls?.length > 0 || project.quote_url || project.invoice_url) },
    { id: "notes", label: "Notes", icon: FileText, show: project.notes },
  ].filter(tab => tab.show !== false);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E3E5] sticky top-0 z-10">
        <div className="p-3 md:p-4">
          <div className="flex items-start justify-between gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-9 w-9 md:h-12 md:w-12 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-[22px] font-semibold text-[#111111] mb-0.5 md:mb-1">{project.title}</h1>
                <p className="text-xs md:text-[13px] text-[#4F4F4F]">{project.project_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <Badge className="status-badge status-{project.status} text-xs">
                {project.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 md:h-12 md:w-12">
                    <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(project)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAddJob}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Job
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto px-3 md:px-4 gap-1 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2.5 md:py-3 text-xs md:text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-[#FAE008] text-[#111111]'
                  : 'border-transparent text-[#4F4F4F] hover:text-[#111111]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-[#F7F7F7] text-[#4F4F4F] rounded-full px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-2 md:p-4 space-y-2 md:space-y-4 pb-24">
        {activeTab === "overview" && (
          <>
            {/* Project Summary */}
            <Card className="card-enhanced">
              <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
                <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Project Summary</h3>
                
                <div 
                  className="cursor-pointer hover:text-[#FAE008] transition-colors"
                  onClick={handleCustomerClick}
                >
                  <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Customer</div>
                  <div className="text-sm md:text-[15px] font-semibold text-[#111111]">{project.customer_name}</div>
                </div>

                {project.address && (
                  <div>
                    <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Address</div>
                    <div className="flex items-start gap-1.5 md:gap-2">
                      <MapPin className="w-3 h-3 md:w-4 md:h-4 text-[#4F4F4F] mt-0.5 flex-shrink-0" />
                      <span className="text-xs md:text-[14px] text-[#111111]">{project.address}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5 md:gap-2 pt-1.5 md:pt-2 border-t border-[#E2E3E5]">
                  {project.customer_phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `tel:${project.customer_phone}`}
                      className="flex-1 h-10 md:h-12 text-xs"
                    >
                      <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                      Call
                    </Button>
                  )}
                  {project.customer_email && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `mailto:${project.customer_email}`}
                      className="flex-1 h-10 md:h-12 text-xs"
                    >
                      <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                      Email
                    </Button>
                  )}
                </div>

                {project.created_date && (
                  <div className="pt-1.5 md:pt-2 border-t border-[#E2E3E5]">
                    <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Created</div>
                    <div className="text-xs md:text-[14px] text-[#111111]">{new Date(project.created_date).toLocaleDateString()}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {project.description && (
              <Card className="card-enhanced">
                <CardContent className="p-3 md:p-4">
                  <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Description</h3>
                  <Collapsible>
                    <div 
                      className="text-xs md:text-[14px] text-[#111111] leading-relaxed prose prose-sm max-w-none line-clamp-4"
                      dangerouslySetInnerHTML={{ __html: project.description }}
                    />
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="mt-1.5 md:mt-2 h-7 md:h-8 text-xs md:text-[13px]">
                        <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" />
                        Show more
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div 
                        className="text-xs md:text-[14px] text-[#111111] leading-relaxed prose prose-sm max-w-none mt-1.5 md:mt-2"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )}

            {/* Financials */}
            {(project.quote_value || project.invoice_value || project.payment_received) && (
              <Card className="card-enhanced">
                <CardContent className="p-3 md:p-4">
                  <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Financials</h3>
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {project.quote_value && (
                      <div>
                        <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Quote</div>
                        <div className="text-sm md:text-[18px] font-semibold text-[#111111]">${project.quote_value}</div>
                      </div>
                    )}
                    {project.invoice_value && (
                      <div>
                        <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Invoice</div>
                        <div className="text-sm md:text-[18px] font-semibold text-[#111111]">${project.invoice_value}</div>
                      </div>
                    )}
                    {project.payment_received && (
                      <div>
                        <div className="text-[10px] md:text-[12px] text-[#4F4F4F] mb-0.5 md:mb-1">Paid</div>
                        <div className="text-sm md:text-[18px] font-semibold text-[#16A34A]">${project.payment_received}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "jobs" && (
          <Card className="card-enhanced">
            <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide">Jobs ({jobs.length})</h3>
                <Button
                  onClick={handleAddJob}
                  size="sm"
                  className="btn-primary h-10 md:h-12 px-3 md:px-4 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                  Add Job
                </Button>
              </div>

              {jobs.length === 0 ? (
                <div className="text-center py-8 md:py-12 bg-[#F7F7F7] rounded-xl">
                  <Briefcase className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 text-[#BDBDBD]" />
                  <p className="text-xs md:text-[14px] text-[#4F4F4F] mb-3 md:mb-4">No jobs yet</p>
                  <Button onClick={handleAddJob} className="btn-primary h-10 md:h-12 text-xs">
                    Create First Job
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {jobs.map((job) => {
                    const jobSummaries = getJobSummaries(job.id);
                    return (
                      <Card
                        key={job.id}
                        className="card-interactive"
                        onClick={() => handleJobClick(job.id)}
                      >
                        <CardContent className="p-3 md:p-4">
                          <div className="flex items-start justify-between gap-3 md:gap-4 mb-1.5 md:mb-2">
                            <div>
                              <div className="text-sm md:text-[15px] font-bold text-[#111111] mb-0.5 md:mb-1">
                                {job.job_type_name || 'Job'} #{job.job_number}
                              </div>
                              {job.scheduled_date && (
                                <div className="flex items-center gap-1 text-xs md:text-[13px] text-[#4F4F4F]">
                                  <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                  {new Date(job.scheduled_date).toLocaleDateString()}
                                  {job.scheduled_time && ` at ${job.scheduled_time}`}
                                </div>
                              )}
                            </div>
                            <Badge className="status-badge status-{job.status} text-xs">
                              {job.status}
                            </Badge>
                          </div>

                          {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                            <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-[13px] text-[#4F4F4F] mt-1.5 md:mt-2">
                              <UserIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              <span>{Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(', ') : job.assigned_to_name}</span>
                            </div>
                          )}

                          {!job.assigned_to_name || job.assigned_to_name.length === 0 && (
                            <div className="text-xs md:text-[13px] text-[#BDBDBD] mt-1.5 md:mt-2">
                              Unassigned
                            </div>
                          )}

                          <JobVisitCard 
                            jobSummaries={jobSummaries}
                            jobImages={job.image_urls}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "installation" && (
          <Card className="card-enhanced">
            <CardContent className="p-3 md:p-4">
              <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Installation Details</h3>
              <div className="space-y-2 md:space-y-3">
                {project.doors?.map((door, idx) => (
                  <Collapsible key={idx} defaultOpen={idx === 0}>
                    <div className="bg-white border border-[#E2E3E5] rounded-xl overflow-hidden">
                      <CollapsibleTrigger className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-[#F7F7F7] transition-colors">
                        <span className="text-sm md:text-[15px] font-semibold text-[#111111]">Door {idx + 1}</span>
                        <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-[#4F4F4F] transition-transform data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 md:p-4 pt-0 space-y-1.5 md:space-y-2">
                          <div className="grid grid-cols-2 gap-2 md:gap-3">
                            {door.height && (
                              <div className="bg-[#F7F7F7] rounded-lg p-2 md:p-3">
                                <div className="text-[10px] md:text-[12px] font-medium text-[#4F4F4F] mb-0.5 md:mb-1">Height</div>
                                <div className="text-sm md:text-[15px] font-semibold text-[#111111]">{door.height}</div>
                              </div>
                            )}
                            {door.width && (
                              <div className="bg-[#F7F7F7] rounded-lg p-2 md:p-3">
                                <div className="text-[10px] md:text-[12px] font-medium text-[#4F4F4F] mb-0.5 md:mb-1">Width</div>
                                <div className="text-sm md:text-[15px] font-semibold text-[#111111]">{door.width}</div>
                              </div>
                            )}
                            {door.type && (
                              <div className="bg-[#F7F7F7] rounded-lg p-2 md:p-3">
                                <div className="text-[10px] md:text-[12px] font-medium text-[#4F4F4F] mb-0.5 md:mb-1">Type</div>
                                <div className="text-sm md:text-[15px] font-semibold text-[#111111]">{door.type}</div>
                              </div>
                            )}
                            {door.style && (
                              <div className="bg-[#F7F7F7] rounded-lg p-2 md:p-3">
                                <div className="text-[10px] md:text-[12px] font-medium text-[#4F4F4F] mb-0.5 md:mb-1">Style</div>
                                <div className="text-sm md:text-[15px] font-semibold text-[#111111]">{door.style}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "attachments" && (
          <Card className="card-enhanced">
            <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
              {project.image_urls && project.image_urls.length > 0 && (
                <div>
                  <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Images</h3>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
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
                          className="w-full h-24 md:h-32 object-cover rounded-xl shadow-soft hover:shadow-md transition-all"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(project.quote_url || project.invoice_url) && (
                <div>
                  <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Files</h3>
                  <div className="space-y-1.5 md:space-y-2">
                    {project.quote_url && (
                      <div className="bg-white border border-[#E2E3E5] rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-[14px] font-semibold text-[#111111]">Quote Document</div>
                            <div className="text-[10px] md:text-[12px] text-[#4F4F4F]">PDF file</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 md:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.quote_url, '_blank')}
                            className="flex-1 h-9 md:h-10 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.quote_url, '_blank')}
                            className="flex-1 h-9 md:h-10 text-xs"
                          >
                            <Download className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    {project.invoice_url && (
                      <div className="bg-white border border-[#E2E3E5] rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-[14px] font-semibold text-[#111111]">Invoice Document</div>
                            <div className="text-[10px] md:text-[12px] text-[#4F4F4F]">PDF file</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 md:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.invoice_url, '_blank')}
                            className="flex-1 h-9 md:h-10 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(project.invoice_url, '_blank')}
                            className="flex-1 h-9 md:h-10 text-xs"
                          >
                            <Download className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "notes" && (
          <Card className="card-enhanced">
            <CardContent className="p-3 md:p-4">
              <h3 className="text-[10px] md:text-[13px] font-semibold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3">Notes</h3>
              <div 
                className="text-xs md:text-[14px] text-[#111111] leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: project.notes }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions - Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E3E5] p-3 md:p-4 shadow-lg">
        <div className="flex gap-1.5 md:gap-2">
          <Button
            onClick={handleAddJob}
            className="btn-primary flex-1 h-10 md:h-12 text-xs"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2" />
            Add Job
          </Button>
          <Button
            onClick={() => onEdit(project)}
            variant="outline"
            className="h-10 md:h-12 px-3 md:px-4"
          >
            <Edit className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base md:text-[18px] font-semibold">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-[14px] text-[#4F4F4F]">
              This project will be moved to the archive. Associated jobs will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 md:h-12 text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(project.id)}
              className="bg-[#DC2626] hover:bg-[#B91C1C] h-10 md:h-12 text-sm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}