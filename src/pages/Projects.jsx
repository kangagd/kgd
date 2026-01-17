import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { sameId } from "@/components/utils/id";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, SlidersHorizontal, User, Filter, Eye, AlertTriangle, UserX, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { 
  ProjectStatusBadge, 
  ProjectTypeBadge, 
  CustomerTypeBadge, 
  OrganisationTypeBadge 
} from "../components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProjectForm from "../components/projects/ProjectForm";
import ProjectDetails from "../components/projects/ProjectDetails";
import EntityModal from "../components/common/EntityModal.jsx";
import ProjectModalView from "../components/projects/ProjectModalView";
import ProjectImportModal from "../components/projects/ProjectImportModal";
import { createPageUrl } from "@/utils";
import { DuplicateBadge } from "../components/common/DuplicateWarningCard";
import { getProjectFreshnessBadge, getProjectAge } from "../components/utils/freshness";
import { useLocation } from "react-router-dom";
import EntityLink from "../components/common/EntityLink";
import BackButton from "../components/common/BackButton";
import { useNavigate } from "react-router-dom";
import { QUERY_CONFIG } from "../components/api/queryConfig";
import { projectKeys, jobKeys } from "../components/api/queryKeys";
import { getProjectDisplayTitle, getProjectDisplayAddress, getProjectCustomerLabel } from "../components/projects/projectDisplay";
import ProjectCard from '../components/projects/ProjectCard';

export default function Projects() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [stageFilter, setStageFilter] = useState("all");
  const [partsStatusFilter, setPartsStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("created_date");
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [modalProject, setModalProject] = useState(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
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

  const isAdmin = user?.role === 'admin';
  const isManager = user?.extended_role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isViewer = user?.role === 'viewer';
  const canCreateProjects = isAdminOrManager;

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: projectKeys.all,
    queryFn: async () => {
      const response = await base44.functions.invoke('getMyProjects');
      console.log(`[Projects Page] Received ${response.data?.projects?.length || 0} projects from backend`);
      return response.data?.projects || [];
    },
    ...QUERY_CONFIG.reference,
    onError: (error) => {
      if (error?.response?.status === 429) {
        toast.error('Rate limit hit – slowing down');
      }
    }
  });

  const projects = allProjects.filter(p => !p.deleted_at && p.status !== "Lost");
  console.log(`[Projects Page] Displaying ${projects.length} projects after filtering out deleted/lost`);

  const { data: allJobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: jobKeys.all,
    queryFn: () => base44.entities.Job.filter({ deleted_at: { $exists: false } }),
    ...QUERY_CONFIG.reference
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['allParts'],
    queryFn: () => base44.entities.Part.list(),
    ...QUERY_CONFIG.reference
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ['allTradeRequirements'],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
    ...QUERY_CONFIG.reference,
  });

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['allPurchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    ...QUERY_CONFIG.reference,
  });



  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ['allTradeRequirements'],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
    ...QUERY_CONFIG.reference,
  });

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['allPurchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    ...QUERY_CONFIG.reference,
  });









  const jobsByProjectId = useMemo(() => {
    const map = new Map();
    allJobs.forEach(job => {
      if (!job.project_id) return;
      if (!map.has(job.project_id)) {
        map.set(job.project_id, []);
      }
      map.get(job.project_id).push(job);
    });
    return map;
  }, [allJobs]);

  const partsByProjectId = useMemo(() => {
    const map = new Map();
    allParts.forEach(part => {
      if (!part.project_id) return;
      if (!map.has(part.project_id)) {
        map.set(part.project_id, []);
      }
      map.get(part.project_id).push(part);
    });
    return map;
  }, [allParts]);

  const tradesByProjectId = useMemo(() => {
    const map = new Map();
    allTradeRequirements.forEach(trade => {
      if (!trade.project_id) return;
      if (!map.has(trade.project_id)) {
        map.set(trade.project_id, []);
      }
      map.get(trade.project_id).push(trade);
    });
    return map;
  }, [allTradeRequirements]);

  const poMap = useMemo(() => new Map(allPurchaseOrders.map(po => [po.id, po])), [allPurchaseOrders]);

  const detectShortage = useCallback((part) => {
    // Cancelled or installed parts are not shortages
    if (part.status === 'cancelled' || part.status === 'installed') {
      return false;
    }
    
    // CRITICAL: Check linked PO status first (takes precedence)
    if (part.purchase_order_id) {
      const linkedPO = poMap.get(part.purchase_order_id);
      if (linkedPO) {
        const poStatus = (linkedPO.status || '').toLowerCase().replace(/[\s_-]/g, '');
        const readyPOStatuses = ['instorage', 'inloadingbay', 'invehicle', 'ready', 'received', 'in_storage', 'in_loading_bay', 'in_vehicle'];
        if (readyPOStatuses.includes(poStatus)) {
          return false;
        }
      }
    }
    
    // CRITICAL: Parts with these statuses are READY (not a shortage)
    const readyStatuses = ['in_storage', 'in_loading_bay', 'in_vehicle', 'ready', 'received', 'instorage', 'invehicle', 'inloadingbay'];
    const normalizedStatus = (part.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (readyStatuses.includes(normalizedStatus)) {
      return false;
    }
    
    // Check if received quantity is available
    const receivedQty = Number(part.received_qty || part.quantity_received || 0);
    if (receivedQty > 0) {
      return false;
    }
    
    // Everything else is a shortage
    return true;
  }, [poMap]);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('manageProject', { action: 'create', data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data.project;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      setEditingProject(null);
      setShowForm(false);
      navigate(`${createPageUrl("Projects")}?projectId=${newProject.id}`);
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await base44.functions.invoke('manageProject', { action: 'update', id, data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      setShowForm(false);
      setEditingProject(null);
      setSelectedProject(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      return await base44.functions.invoke('manageProject', { action: 'delete', id: projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
      setSelectedProject(null);
      setEditingProject(null);
      setModalProject(null);
      navigate(createPageUrl("Projects"));
      toast.success('Project deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete project');
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const projectId = params.get('projectId');
    
    if (action === 'new' || action === 'create') {
      setShowForm(true);
      return;
    }
    
    if (projectId && allProjects.length > 0) {
      // Use allProjects instead of filtered projects to ensure we find it
      const project = allProjects.find((p) => sameId(p.id, projectId));
      if (project && !sameId(project.id, selectedProject?.id)) {
        setSelectedProject(project);
      }
    } else if (!projectId && selectedProject) {
      // Clear selected project when projectId is removed from URL
      setSelectedProject(null);
    }
  }, [allProjects, selectedProject, location.search]);

  const handleSubmit = (data) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
    setSelectedProject(null);
  };

  const handleDelete = useCallback((projectId) => {
    deleteProjectMutation.mutate(projectId);
  }, [deleteProjectMutation]);

  const handleOpenFullProject = useCallback((project) => {
    setModalProject(null);
    navigate(`${createPageUrl("Projects")}?projectId=${project.id}`);
  }, [navigate]);

  const filteredProjects = useMemo(() => {
    const baseProjects = projects;
    
    return baseProjects
      .filter((project) => {
        const matchesSearch = 
          project.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.customer_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.address_full?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.project_number?.toString().includes(debouncedSearchTerm);
        
        const matchesStage = stageFilter === "all" || project.status === stageFilter;
        
        const projectParts = partsByProjectId.get(project.id) || [];
        const matchesPartsStatus = partsStatusFilter === "all" || 
          projectParts.some(p => p.status === partsStatusFilter);
        
        let matchesDateRange = true;
        if (startDate || endDate) {
          const createdAt = project.created_at || project.created_date || project.createdDate;
          const projectDate = new Date(createdAt);
          if (startDate && new Date(startDate) > projectDate) matchesDateRange = false;
          if (endDate && new Date(endDate) < projectDate) matchesDateRange = false;
        }

        const matchesDuplicateFilter = !showDuplicatesOnly || project.is_potential_duplicate;
        
        return matchesSearch && matchesStage && matchesPartsStatus && matchesDateRange && matchesDuplicateFilter;
      })
      .sort((a, b) => {
        if (sortBy === "created_date") {
          const dateA = a.created_at || a.created_date || a.createdDate;
          const dateB = b.created_at || b.created_date || b.createdDate;
          return new Date(dateB) - new Date(dateA);
        } else if (sortBy === "stage") {
          const stages = ["Lead", "Initial Site Visit", "Create Quote", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered", "Scheduled", "Completed", "Warranty"];
          return stages.indexOf(a.status) - stages.indexOf(b.status);
        }
        return 0;
      });
  }, [projects, debouncedSearchTerm, stageFilter, partsStatusFilter, startDate, endDate, sortBy, showDuplicatesOnly, allParts]);

                const getJobCount = useCallback((projectId) => {
          return (jobsByProjectId.get(projectId) || []).length;
        }, [jobsByProjectId]);

                const getNextJob = useCallback((projectId) => {
          const projectJobs = jobsByProjectId.get(projectId) || [];
          const futureJobs = projectJobs.filter(j => j.scheduled_date && new Date(j.scheduled_date) >= new Date());
          if (futureJobs.length === 0) return null;
          return futureJobs.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];
        }, [jobsByProjectId]);

        const extractSuburb = useCallback((address) => {
        if (!address) return null;
        const parts = address.split(',').map(p => p.trim());
        return parts.length > 1 ? parts[parts.length - 2] : null;
        }, []);

        const buildScopeSummary = useCallback((project) => {
        if (!project.doors || project.doors.length === 0) return null;
        const doorCount = project.doors.length;
        const firstDoor = project.doors[0];
        const doorType = firstDoor.type || 'doors';
        const dimensions = firstDoor.height && firstDoor.width ? `${firstDoor.height} x ${firstDoor.width}` : '';
        return `${doorCount}x ${doorType}${dimensions ? ` • ${dimensions}` : ''}`;
        }, []);

                const hasRequiredTrades = useCallback((projectId) => {
          const projectTrades = tradesByProjectId.get(projectId) || [];
          return projectTrades.some(t => t.is_required);
        }, [tradesByProjectId]);

        const hasCustomerIssue = useCallback((project) => {
          if (!project) return false;
          // No customer ID or missing both phone and email
          return !project.customer_id || (!project.customer_phone && !project.customer_email);
        }, []);

  if (showForm) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <ProjectForm
            project={editingProject}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingProject(null);
            }}
            isSubmitting={createProjectMutation.isPending || updateProjectMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <div className="mx-auto p-5 md:p-10 max-w-6xl">
          <ProjectDetails
            project={selectedProject}
            onClose={() => {
              setSelectedProject(null);
              navigate(createPageUrl("Projects"));
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Projects</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage all projects and quotes</p>
          </div>
          {canCreateProjects && (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setShowImportModal(true)}
                  variant="outline"
                  className="h-10 px-4 text-sm rounded-xl"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
              />
              <button 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide max-w-full">
            <Tabs value={stageFilter} onValueChange={setStageFilter} className="max-w-full">
              <TabsList className="inline-flex w-auto justify-start max-w-full">
                <TabsTrigger value="all" className="whitespace-nowrap flex-shrink-0">All Projects</TabsTrigger>
                <TabsTrigger value="Lead" className="whitespace-nowrap flex-shrink-0">Lead</TabsTrigger>
                <TabsTrigger value="Initial Site Visit" className="whitespace-nowrap flex-shrink-0">Initial Site Visit</TabsTrigger>
                <TabsTrigger value="Create Quote" className="whitespace-nowrap flex-shrink-0">Create Quote</TabsTrigger>
                <TabsTrigger value="Quote Sent" className="whitespace-nowrap flex-shrink-0">Quote Sent</TabsTrigger>
                <TabsTrigger value="Quote Approved" className="whitespace-nowrap flex-shrink-0">Quote Approved</TabsTrigger>
                <TabsTrigger value="Final Measure" className="whitespace-nowrap flex-shrink-0">Final Measure</TabsTrigger>
                <TabsTrigger value="Parts Ordered" className="whitespace-nowrap flex-shrink-0">Parts Ordered</TabsTrigger>
                <TabsTrigger value="Scheduled" className="whitespace-nowrap flex-shrink-0">Scheduled</TabsTrigger>
                <TabsTrigger value="Completed" className="whitespace-nowrap flex-shrink-0">Completed</TabsTrigger>
                <TabsTrigger value="Warranty" className="whitespace-nowrap flex-shrink-0">Warranty</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="project-duplicates-filter"
              checked={showDuplicatesOnly}
              onCheckedChange={setShowDuplicatesOnly}
            />
            <label
              htmlFor="project-duplicates-filter"
              className="text-sm text-[#4B5563] cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
              Show only potential duplicates
            </label>
          </div>

          {showFilters && (
            <Card className="border border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="max-w-full overflow-x-auto pb-2">
                  <div className="flex gap-3 min-w-max">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
                      <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
                      <SelectItem value="Create Quote">Create Quote</SelectItem>
                      <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                      <SelectItem value="Quote Approved">Quote Approved</SelectItem>
                      <SelectItem value="Final Measure">Final Measure</SelectItem>
                      <SelectItem value="Parts Ordered">Parts Ordered</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Warranty">Warranty</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={partsStatusFilter} onValueChange={setPartsStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px] h-10">
                      <SelectValue placeholder="Parts Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Ordered">Ordered</SelectItem>
                      <SelectItem value="Back-ordered">Back-ordered</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_date">Order Date (Newest)</SelectItem>
                      <SelectItem value="stage">Project Stage</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                    className="w-full md:w-[160px] h-10"
                  />

                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                    className="w-full md:w-[160px] h-10"
                  />

                  {(stageFilter !== "all" || partsStatusFilter !== "all" || startDate || endDate || sortBy !== "created_date") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStageFilter("all");
                        setPartsStatusFilter("all");
                        setStartDate("");
                        setEndDate("");
                        setSortBy("created_date");
                      }}
                      className="h-10"
                    >
                      Clear Filters
                    </Button>
                  )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-[hsl(25,8%,45%)]">Loading projects...</p>
          </div>
        )}

        {!isLoading && filteredProjects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <p className="text-[14px] text-[#4B5563] leading-[1.4] mb-4">No projects found</p>
            <Button onClick={() => setShowForm(true)} className="bg-[#fae008] text-[#111827] font-semibold text-[14px] leading-[1.4]">
              Create First Project
            </Button>
          </div>
        )}

        <div className="grid gap-4">
                    {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              jobCount={getJobCount(project.id)}
              nextJob={getNextJob(project.id)}
              suburb={extractSuburb(project.address_full)}
              freshness={getProjectFreshnessBadge(project)}
              age={getProjectAge(project)}
              hasCustomerIssue={hasCustomerIssue(project)}
              hasShortage={(partsByProjectId.get(project.id) || []).some(detectShortage)}
              hasRequiredTrades={hasRequiredTrades(project.id)}
              onViewDetails={setModalProject}
              displayTitle={getProjectDisplayTitle(project)}
              customerLabel={getProjectCustomerLabel(project)}
            />
          ))}
            
          })}
        </div>

        <EntityModal
          open={!!modalProject}
          onClose={() => setModalProject(null)}
          title={getProjectDisplayTitle(modalProject)}
          onOpenFullPage={() => handleOpenFullProject(modalProject)}
          fullPageLabel="Open Full Project"
        >
          {modalProject && (
            <ProjectModalView 
              project={modalProject} 
              jobCount={getJobCount(modalProject.id)}
            />
          )}
        </EntityModal>

        <ProjectImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
          }}
        />
      </div>
    </div>
  );
}