import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, FileText, DollarSign, Wrench, Mail, CheckSquare, Clock, Sparkles, ClipboardCheck, Image as ImageIcon, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

// Components
import ProjectSidebar from "./ProjectSidebar";
import ProjectStageSelector from "./ProjectStageSelector";
import ProjectSummary from "./ProjectSummary";
import ProjectQuotesTab from "./ProjectQuotesTab";
import ProjectInvoicesTab from "./ProjectInvoicesTab";
import ProjectEmailSection from "./ProjectEmailSection";
import PartsSection from "./PartsSection";
import FinancialsTab from "./FinancialsTab";
import WarrantyCard from "./WarrantyCard";
import MaintenanceSection from "./MaintenanceSection";
import RichTextField from "../common/RichTextField";
import ActivityTimeline from "../common/ActivityTimeline";
import { ProjectTypeBadge, ProductTypeBadge } from "../common/StatusBadge";
import { DuplicateBadge } from "../common/DuplicateWarningCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ProjectDetails({ project: initialProject, onClose, onEdit, onDelete, emailThreadId: propsEmailThreadId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [showAIContextModal, setShowAIContextModal] = useState(false);

  // Permission checks
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const canEdit = isAdminOrManager;
  const canDelete = isAdminOrManager;

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: project = initialProject } = useQuery({
    queryKey: ['project', initialProject.id],
    queryFn: () => base44.entities.Project.get(initialProject.id),
    initialData: initialProject
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: async () => {
      const projectJobs = await base44.entities.Job.filter({ project_id: project.id });
      return projectJobs.filter(job => !job.deleted_at);
    },
    refetchInterval: 5000,
    enabled: !!project.id
  });

  // Mutations
  const updateProjectMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Project.update(project.id, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    }
  });

  const handleStatusChange = (newStatus) => {
    updateProjectMutation.mutate({ field: 'status', value: newStatus });
  };

  // State for Description / Notes / Measurements
  const [description, setDescription] = useState(project.description || "");
  const [notes, setNotes] = useState(project.notes || "");
  // Measurements: assume stored in project.doors (array) or project.measurements (object)
  // Project form uses `doors`. We'll assume `doors` is the main measurement data.
  // If `doors` is undefined, we initialize it.
  
  React.useEffect(() => {
    setDescription(project.description || "");
    setNotes(project.notes || "");
  }, [project.description, project.notes]);

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

  // Handle AI Context
  const urlParams = new URLSearchParams(window.location.search);
  const aiContextParam = urlParams.get('aiContext');
  React.useEffect(() => {
      if (aiContextParam === 'true') {
          setShowAIContextModal(true);
          const newUrl = window.location.pathname + `?projectId=${initialProject.id}`;
          window.history.replaceState({}, '', newUrl);
      }
  }, [aiContextParam, initialProject.id]);

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 overflow-x-hidden items-start">
      {/* Sidebar */}
      <ProjectSidebar 
        project={project} 
        jobs={jobs} 
        canEdit={canEdit} 
        canDelete={canDelete}
      />

      {/* Main Content */}
      <div className="flex-1 w-full lg:min-w-0">
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
          {/* Header */}
          <CardHeader className="border-b border-[#E5E7EB] bg-white p-3 md:p-4 space-y-3">
             <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-[22px] font-semibold text-[#111827]">{project.title}</h2>
                    <DuplicateBadge record={project} />
                    <ProjectTypeBadge value={project.project_type} className="ml-2" />
                    {project.project_type && (
                        <ProductTypeBadge 
                            value={(() => {
                                if (project.project_type.includes("Garage Door")) return "Garage Door";
                                if (project.project_type.includes("Gate")) return "Gate";
                                if (project.project_type.includes("Roller Shutter")) return "Roller Shutter";
                                if (project.project_type === "Multiple") return "Multiple";
                                return null;
                            })()} 
                            className="ml-2" 
                        />
                    )}
                    {project.contract_id && (
                        <Link to={createPageUrl("Contracts") + `?contractId=${project.contract_id}`}>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer gap-1 ml-2">
                                <FileText className="w-3 h-3" />
                                Contract
                            </Badge>
                        </Link>
                    )}
                </div>
                <div className="flex gap-1">
                    {canEdit && <Button variant="ghost" size="icon" onClick={() => onEdit(project)}><Edit className="w-4 h-4"/></Button>}
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => onDelete(project.id)}><Trash2 className="w-4 h-4 text-red-600"/></Button>}
                </div>
             </div>
             <div className="pt-2">
                <ProjectStageSelector 
                    currentStage={project.status} 
                    onStageChange={handleStatusChange}
                />
             </div>
          </CardHeader>

          <CardContent className="p-3 md:p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-4">
                <TabsList className="w-full justify-start min-w-max md:min-w-0">
                    <TabsTrigger value="overview" className="flex-1 whitespace-nowrap">
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="flex-1 whitespace-nowrap">
                        <Mail className="w-4 h-4 mr-2" />
                        Emails
                    </TabsTrigger>
                    <TabsTrigger value="quotes" className="flex-1 whitespace-nowrap">
                        <FileText className="w-4 h-4 mr-2" />
                        Quoting
                    </TabsTrigger>
                    <TabsTrigger value="parts" className="flex-1 whitespace-nowrap">
                        <Wrench className="w-4 h-4 mr-2" />
                        Parts
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="flex-1 whitespace-nowrap">
                        <FileText className="w-4 h-4 mr-2" />
                        Invoices
                    </TabsTrigger>
                    {(isAdminOrManager) && (
                    <TabsTrigger value="financials" className="flex-1 whitespace-nowrap">
                        <DollarSign className="w-4 h-4 mr-2" />
                        Financials
                    </TabsTrigger>
                    )}
                    <TabsTrigger value="summary" className="flex-1 whitespace-nowrap">
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Summary
                    </TabsTrigger>
                    <TabsTrigger value="warranty" className="flex-1 whitespace-nowrap">
                        <Clock className="w-4 h-4 mr-2" />
                        Warranty
                    </TabsTrigger>
                </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    {/* Contract Banner */}
                    {project.contract_id && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-full">
                            <FileText className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                            <div className="text-sm font-medium text-purple-900">Linked Contract</div>
                            <div className="text-lg font-bold text-purple-900">Contract #{project.contract_id}</div>
                            </div>
                        </div>
                        <Link to={createPageUrl("Contracts")}>
                            <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-100">
                            View Contract
                            </Button>
                        </Link>
                        </div>
                    )}

                    <Card className="border-2 border-slate-100 shadow-sm">
                        <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-500" />
                            Project Details
                        </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                        <RichTextField
                            label="Description"
                            value={description}
                            onChange={setDescription}
                            onBlur={handleDescriptionBlur}
                            placeholder="Detailed description of the project..."
                        />
                        <RichTextField
                            label="Internal Notes"
                            value={notes}
                            onChange={setNotes}
                            onBlur={handleNotesBlur}
                            placeholder="Notes for internal reference..."
                        />
                        
                        {/* Measurements */}
                        <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Measurements Provided</h4>
                            {(project.doors || []).length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {project.doors.map((door, idx) => (
                                        <Badge key={idx} variant="secondary" className="px-3 py-1.5 text-sm font-normal">
                                            {door.width} x {door.height} • {door.type} • {door.style}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No measurements recorded</p>
                            )}
                            {/* Note: Editing measurements currently done in ProjectForm edit mode */}
                        </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Emails Tab */}
                <TabsContent value="emails" className="space-y-6">
                    <ProjectEmailSection 
                        project={project} 
                        onThreadLinked={() => queryClient.invalidateQueries({ queryKey: ['project', project.id] })}
                    />
                </TabsContent>

                {/* Quoting Tab */}
                <TabsContent value="quotes" className="space-y-6">
                    <ProjectQuotesTab project={project} user={user} />
                </TabsContent>

                {/* Parts Tab */}
                <TabsContent value="parts" className="space-y-6">
                    <PartsSection projectId={project.id} />
                </TabsContent>

                {/* Invoices Tab */}
                <TabsContent value="invoices" className="space-y-6">
                    <ProjectInvoicesTab project={project} user={user} />
                </TabsContent>

                {/* Financials Tab */}
                <TabsContent value="financials" className="space-y-6">
                    <FinancialsTab project={project} onUpdate={(fields) => {
                        Object.entries(fields).forEach(([field, value]) => {
                            updateProjectMutation.mutate({ field, value });
                        });
                    }} />
                </TabsContent>

                {/* Summary Tab */}
                <TabsContent value="summary" className="space-y-6">
                    <ProjectSummary 
                        project={project}
                    />
                </TabsContent>

                {/* Warranty Tab */}
                <TabsContent value="warranty" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <WarrantyCard project={project} />
                        <MaintenanceSection projectId={project.id} />
                    </div>
                </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* AI Context Modal */}
      <Dialog open={showAIContextModal} onOpenChange={setShowAIContextModal}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    AI Context Extracted
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <p className="text-sm text-slate-600">
                    We analyzed the email and populated some project details for you.
                </p>
                <div className="bg-indigo-50 p-3 rounded-lg space-y-2 border border-indigo-100">
                    {project.issue_summary && (
                        <div>
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Issue Summary</span>
                            <p className="text-sm text-indigo-900">{project.issue_summary}</p>
                        </div>
                    )}
                    {project.urgency && (
                        <div>
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Urgency</span>
                            <p className="text-sm text-indigo-900">{project.urgency}</p>
                        </div>
                    )}
                    {project.address && (
                        <div>
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Address</span>
                            <p className="text-sm text-indigo-900">{project.address}</p>
                        </div>
                    )}
                    {project.initial_notes && (
                        <div>
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Notes</span>
                            <p className="text-sm text-indigo-900">{project.initial_notes}</p>
                        </div>
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button onClick={() => setShowAIContextModal(false)}>Done</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}