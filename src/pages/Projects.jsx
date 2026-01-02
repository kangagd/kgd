import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { sameId } from "@/components/utils/id";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, SlidersHorizontal, User, Filter, Eye, AlertTriangle } from "lucide-react";
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
import { createPageUrl } from "@/utils";
import { DuplicateBadge } from "../components/common/DuplicateWarningCard";
import { getProjectFreshnessBadge, getProjectAge } from "../components/utils/freshness";
import { useLocation } from "react-router-dom";
import EntityLink from "../components/common/EntityLink";
import BackButton from "../components/common/BackButton";
import { useNavigate } from "react-router-dom";

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
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isViewer = user?.role === 'viewer';
  const canCreateProjects = isAdminOrManager;

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const projects = allProjects.filter(p => !p.deleted_at && p.status !== "Lost");

  const { data: allJobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: ['allJobs'],
    queryFn: async () => {
      const jobs = await base44.entities.Job.list();
      return jobs.filter(j => !j.deleted_at);
    }
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['allParts'],
    queryFn: () => base44.entities.Part.list(),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
  });

  const { data: inventoryQuantities = [] } = useQuery({
    queryKey: ['inventoryQuantities'],
    queryFn: () => base44.entities.InventoryQuantity.list(),
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ['allTradeRequirements'],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
  });

  const inventoryByItem = useMemo(() => {
    const map = {};
    // Warehouse from PriceList
    for (const item of priceListItems) {
      map[item.id] = (map[item.id] || 0) + (item.stock_level || 0);
    }
    // Vehicles from InventoryQuantity
    for (const iq of inventoryQuantities) {
      if (iq.price_list_item_id && iq.location_type === 'vehicle') {
        map[iq.price_list_item_id] = (map[iq.price_list_item_id] || 0) + (iq.quantity_on_hand || 0);
      }
    }
    return map;
  }, [priceListItems, inventoryQuantities]);

  const detectShortage = useCallback((part) => {
    // Cancelled or installed parts are not shortages
    if (part.status === 'cancelled' || part.status === 'installed') {
      return false;
    }
    
    // CRITICAL: Parts with these statuses are READY (not a shortage)
    const readyStatuses = ['in_storage', 'in_loading_bay', 'in_vehicle', 'ready', 'received', 'instorage', 'invehicle', 'inloadingbay'];
    const normalizedStatus = (part.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (readyStatuses.includes(part.status) || readyStatuses.includes(normalizedStatus)) {
      return false;
    }
    
    // Check if received quantity is available
    const receivedQty = Number(part.received_qty || part.quantity_received || 0);
    if (receivedQty > 0) {
      return false;
    }
    
    // Everything else is a shortage
    return true;
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('manageProject', { action: 'create', data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data.project;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
      setShowForm(false);
      // Navigate to the new project page
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setEditingProject(null);
      setSelectedProject(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      // Get the project to check for linked email thread
      const project = projects.find(p => p.id === projectId);
      
      // If project has a linked email thread, unlink it
      if (project?.source_email_thread_id) {
        try {
          await base44.entities.EmailThread.update(project.source_email_thread_id, {
            linked_project_id: null,
            linked_project_title: null
          });
        } catch (error) {
          console.error('Error unlinking email thread:', error);
        }
      }
      
      await base44.entities.Project.update(projectId, { deleted_at: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      setSelectedProject(null);
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

  const filteredProjects = useMemo(() => projects
    .filter((project) => {
      const matchesSearch = 
        project.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        project.customer_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      const matchesStage = stageFilter === "all" || project.status === stageFilter;
      
      const projectParts = allParts.filter(p => sameId(p.project_id, project.id));
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
        const stages = ["Lead", "Initial Site Visit", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered", "Scheduled", "Completed", "Warranty"];
        return stages.indexOf(a.status) - stages.indexOf(b.status);
        }
        return 0;
        }), [projects, debouncedSearchTerm, stageFilter, partsStatusFilter, startDate, endDate, sortBy, showDuplicatesOnly, allParts]);

        const getJobCount = useCallback((projectId) => {
          return allJobs.filter(j => sameId(j.project_id, projectId) && !j.deleted_at).length;
        }, [allJobs]);

        const getNextJob = useCallback((projectId) => {
          const projectJobs = allJobs.filter(j => sameId(j.project_id, projectId) && !j.deleted_at && j.scheduled_date);
        const futureJobs = projectJobs.filter(j => new Date(j.scheduled_date) >= new Date());
        if (futureJobs.length === 0) return null;
        return futureJobs.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];
        }, [allJobs]);

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
          return allTradeRequirements.some(t => sameId(t.project_id, projectId) && t.is_required);
        }, [allTradeRequirements]);

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
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
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

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <Tabs value={stageFilter} onValueChange={setStageFilter}>
              <TabsList className="inline-flex w-auto justify-start">
                <TabsTrigger value="all" className="whitespace-nowrap flex-shrink-0">All Projects</TabsTrigger>
                <TabsTrigger value="Lead" className="whitespace-nowrap flex-shrink-0">Lead</TabsTrigger>
                <TabsTrigger value="Initial Site Visit" className="whitespace-nowrap flex-shrink-0">Initial Site Visit</TabsTrigger>
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
                <div className="flex flex-wrap gap-3">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
                      <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Initial Site Visit">Initial Site Visit</SelectItem>
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
          {filteredProjects.map((project) => {
            const jobCount = getJobCount(project.id);
            const nextJob = getNextJob(project.id);
            const suburb = extractSuburb(project.address);
            const scopeSummary = buildScopeSummary(project);
            const freshness = getProjectFreshnessBadge(project);
            const age = getProjectAge(project);
            
            const freshnessColors = {
              green: "bg-green-100 text-green-700",
              blue: "bg-blue-100 text-blue-700",
              yellow: "bg-yellow-100 text-yellow-700",
              red: "bg-red-100 text-red-700",
              gray: "bg-gray-100 text-gray-700"
            };

            return (
              <EntityLink
                key={project.id}
                to={`${createPageUrl("Projects")}?projectId=${project.id}`}
                className="block"
              >
              <Card
                className="hover:shadow-lg transition-all duration-200 hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalProject(project);
                  }}
                >
                  <Eye className="w-4 h-4 text-[#6B7280]" />
                </Button>
                <CardContent className="p-4">
                  {/* Top row */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 pr-8">
                      <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">{project.title}</h3>
                      <DuplicateBadge record={project} size="sm" />
                      {allParts.filter(p => sameId(p.project_id, project.id)).some(detectShortage) && (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                          Shortage
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={freshnessColors[freshness.color]}>
                        {freshness.label}
                      </Badge>
                      <span className="text-[12px] text-[#6B7280]">Age: {age !== null ? `${age} days` : 'Unknown'}</span>
                      {project.organisation_type && (
                        <OrganisationTypeBadge value={project.organisation_type} />
                      )}
                      {project.customer_type && (
                        <CustomerTypeBadge value={project.customer_type} />
                      )}
                      {project.project_type && (
                        <ProjectTypeBadge value={project.project_type} />
                      )}
                      <ProjectStatusBadge value={project.status} />
                      {hasRequiredTrades(project.id) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 font-medium">
                          Third-party required
                        </span>
                      )}
                    </div>
                    </div>

                  {/* Second row */}
                  <div className="flex items-center gap-4 mb-3 text-[#4B5563] flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span className="text-[14px] leading-[1.4]">{project.customer_name}</span>
                    </div>
                    {suburb && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[14px] leading-[1.4]">{suburb}</span>
                      </div>
                    )}
                  </div>

                  {/* Third row */}
                  {project.stage && (
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="font-medium text-[12px] leading-[1.35] border-[#E5E7EB]">
                        {project.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  )}

                  {/* Bottom row */}
                  <div className="flex items-center justify-between text-[14px] leading-[1.4] pt-3 border-t border-[#E5E7EB]">
                    <span className="text-[#4B5563] font-medium">
                      Jobs: <span className="text-[#111827] font-semibold">{isJobsLoading ? '...' : jobCount}</span>
                    </span>
                    {nextJob && (
                      <div className="text-[#4B5563]">
                        <span className="font-medium">Next: </span>
                        <span className="text-[#111827] font-medium">
                          {new Date(nextJob.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          {nextJob.scheduled_time && ` · ${nextJob.scheduled_time}`}
                          {nextJob.job_type_name && ` · ${nextJob.job_type_name}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </EntityLink>
            );
          })}
        </div>

        <EntityModal
          open={!!modalProject}
          onClose={() => setModalProject(null)}
          title={modalProject?.title || "Project"}
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
      </div>
    </div>
  );
}