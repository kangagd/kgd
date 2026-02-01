import React, { useState, useEffect, useMemo, useCallback } from "react";
import { devLog } from "@/components/utils/devLog";
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
import { projectKeys, jobKeys, inboxKeys } from "../components/api/queryKeys";
import { getProjectDisplayTitle, getProjectDisplayAddress, getProjectCustomerLabel } from "../components/projects/projectDisplay";
import ProjectTagsDisplay from "../components/projects/ProjectTagsDisplay";
import PricingChecklistBadges from "../components/projects/PricingChecklistBadges";

export default function Projects() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [stageFilter, setStageFilter] = useState("all");
  const [partsStatusFilter, setPartsStatusFilter] = useState("all");
  const [pricingStatusFilter, setPricingStatusFilter] = useState("all");
  const [pricingChecklistFilter, setPricingChecklistFilter] = useState([]);
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
  const [tagFilter, setTagFilter] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        devLog("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.extended_role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isViewer = user?.role === 'viewer';
  const canCreateProjects = isAdminOrManager;

  const [pageNum, setPageNum] = useState(1);
  const pageSize = 50;

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: [...projectKeys.all, pageNum],
    queryFn: async () => {
      const response = await base44.functions.invoke('getProjectsForRole', { limit: 500, filters: {} });
      devLog(`[Projects Page] Received ${response.data?.projects?.length || 0} projects from backend`);
      return response.data?.projects || [];
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onError: (error) => {
      if (error?.response?.status === 429) {
        toast.error('Rate limit hit – slowing down');
      }
    }
  });

  const projects = allProjects.filter(p => !p.deleted_at && p.status !== "Lost");
  devLog(`[Projects Page] Displaying ${projects.length} projects after filtering out deleted/lost`);

  const { data: allJobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: jobKeys.all,
    queryFn: () => base44.entities.Job.filter({ deleted_at: { $exists: false } }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onError: (error) => {
      if (error?.response?.status === 429) {
        toast.error('Rate limit hit – slowing down');
      }
    }
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ['parts', 'all'],
    queryFn: () => base44.entities.Part.list(),
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const { data: allTradeRequirements = [] } = useQuery({
    queryKey: ['tradeRequirements', 'all'],
    queryFn: () => base44.entities.ProjectTradeRequirement.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...QUERY_CONFIG.reference,
  });

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders', 'all'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...QUERY_CONFIG.reference,
  });

  const { data: allAttentionItems = [] } = useQuery({
    queryKey: ['attentionItems', 'all'],
    queryFn: () => base44.entities.AttentionItem.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...QUERY_CONFIG.reference,
  });

  const { data: allEmailThreads = [] } = useQuery({
    queryKey: ['emailThreads', 'all'],
    queryFn: () => base44.entities.EmailThread.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...QUERY_CONFIG.reference,
  });

  const { data: projectTags = [] } = useQuery({
    queryKey: ['projectTags'],
    queryFn: () => base44.entities.ProjectTagDefinition.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Build indexes for O(1) lookups instead of per-row scans
  const indexes = useMemo(() => {
    devLog('[Projects] Build indexes');
    
    const jobsByProjectId = new Map();
    const partsByProjectId = new Map();
    const tradeReqByProjectId = new Map();
    const attentionByProjectId = new Map();
    const posByProjectId = new Map();
    const threadsByProjectId = new Map();

    for (const job of allJobs) {
      if (job.project_id) {
        if (!jobsByProjectId.has(job.project_id)) jobsByProjectId.set(job.project_id, []);
        jobsByProjectId.get(job.project_id).push(job);
      }
    }

    for (const part of allParts) {
      if (part.project_id) {
        if (!partsByProjectId.has(part.project_id)) partsByProjectId.set(part.project_id, []);
        partsByProjectId.get(part.project_id).push(part);
      }
    }

    for (const tr of allTradeRequirements) {
      if (tr.project_id) {
        if (!tradeReqByProjectId.has(tr.project_id)) tradeReqByProjectId.set(tr.project_id, []);
        tradeReqByProjectId.get(tr.project_id).push(tr);
      }
    }

    for (const att of allAttentionItems) {
      if (att.project_id) {
        if (!attentionByProjectId.has(att.project_id)) attentionByProjectId.set(att.project_id, []);
        attentionByProjectId.get(att.project_id).push(att);
      }
    }

    for (const po of allPurchaseOrders) {
      if (po.project_id) {
        if (!posByProjectId.has(po.project_id)) posByProjectId.set(po.project_id, []);
        posByProjectId.get(po.project_id).push(po);
      }
    }

    for (const thread of allEmailThreads) {
      if (thread.project_id) {
        if (!threadsByProjectId.has(thread.project_id)) threadsByProjectId.set(thread.project_id, []);
        threadsByProjectId.get(thread.project_id).push(thread);
      }
    }

    devLog('[Projects] Build indexes');
    
    return {
      jobsByProjectId,
      partsByProjectId,
      tradeReqByProjectId,
      attentionByProjectId,
      posByProjectId,
      threadsByProjectId
    };
  }, [allJobs, allParts, allTradeRequirements, allAttentionItems, allPurchaseOrders, allEmailThreads]);

  const detectShortage = useCallback((part) => {
  if (part.status === 'cancelled' || part.status === 'installed') {
  return false;
  }

  if (part.purchase_order_id) {
  const linkedPO = allPurchaseOrders.find(po => po.id === part.purchase_order_id);
  if (linkedPO) {
  const poStatus = (linkedPO.status || '').toLowerCase().replace(/[\s_-]/g, '');
  const readyPOStatuses = ['instorage', 'inloadingbay', 'invehicle', 'ready', 'received', 'in_storage', 'in_loading_bay', 'in_vehicle'];
  if (readyPOStatuses.includes(linkedPO.status) || readyPOStatuses.includes(poStatus)) {
    return false;
  }
  }
  }

  const readyStatuses = ['in_storage', 'in_loading_bay', 'in_vehicle', 'ready', 'received', 'instorage', 'invehicle', 'inloadingbay'];
  const normalizedStatus = (part.status || '').toLowerCase().replace(/[\s_-]/g, '');
  if (readyStatuses.includes(part.status) || readyStatuses.includes(normalizedStatus)) {
  return false;
  }

  const receivedQty = Number(part.received_qty || part.quantity_received || 0);
  if (receivedQty > 0) {
  return false;
  }

  return true;
  }, [allPurchaseOrders]);

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
    devLog('[Projects] Filter & sort');
    const baseProjects = projects;
    
    const filtered = baseProjects
      .filter((project) => {
        const matchesSearch = 
          project.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.customer_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.address_full?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          project.project_number?.toString().includes(debouncedSearchTerm);
        
        const matchesStage = stageFilter === "all" || project.status === stageFilter;
        
        const projectParts = indexes.partsByProjectId.get(project.id) || [];
        const matchesPartsStatus = partsStatusFilter === "all" || 
          projectParts.some(p => p.status === partsStatusFilter);
        
        const matchesTags = tagFilter.length === 0 || 
          (project.project_tag_ids || []).some(tagId => tagFilter.includes(tagId));
        
        let matchesDateRange = true;
        if (startDate || endDate) {
          const createdAt = project.created_at || project.created_date || project.createdDate;
          const projectDate = new Date(createdAt);
          if (startDate && new Date(startDate) > projectDate) matchesDateRange = false;
          if (endDate && new Date(endDate) < projectDate) matchesDateRange = false;
        }

        const matchesDuplicateFilter = !showDuplicatesOnly || project.is_potential_duplicate;
        
        let matchesPricingStatus = true;
        if (stageFilter === "Create Quote" && pricingStatusFilter !== "all") {
          const pricingReceived = project.quote_checklist?.find(item => item.item === "Pricing Received" && item.checked === true);
          const pricingRequested = !pricingReceived && project.quote_checklist?.find(item => item.item === "Pricing Requested" && item.checked === true);
          const pricingStatus = pricingReceived ? 'received' : pricingRequested ? 'requested' : 'none';
          if (pricingStatusFilter === "pricing_requested" && pricingStatus !== "requested") matchesPricingStatus = false;
          if (pricingStatusFilter === "pricing_received" && pricingStatus !== "received") matchesPricingStatus = false;
          if (pricingStatusFilter === "no_pricing" && pricingStatus !== "none") matchesPricingStatus = false;
        }

        let matchesPricingChecklist = true;
        if (pricingChecklistFilter.length > 0) {
          const hasAllChecked = pricingChecklistFilter.every(filterItem =>
            project.quote_checklist?.some(item => item.item === filterItem && item.checked === true)
          );
          if (!hasAllChecked) matchesPricingChecklist = false;
        }
        
        return matchesSearch && matchesStage && matchesPartsStatus && matchesTags && matchesDateRange && matchesDuplicateFilter && matchesPricingStatus && matchesPricingChecklist;
      })
      .sort((a, b) => {
        if (sortBy === "pricing_status") {
          const pricingOrder = { 'received': 0, 'requested': 1, 'none': 2 };
          const pricingReceivedA = a.quote_checklist?.find(item => item.item === "Pricing Received" && item.checked === true);
          const pricingReceivedB = b.quote_checklist?.find(item => item.item === "Pricing Received" && item.checked === true);
          const pricingStatusA = pricingReceivedA ? 'received' : a.quote_checklist?.find(item => item.item === "Pricing Requested" && item.checked === true) ? 'requested' : 'none';
          const pricingStatusB = pricingReceivedB ? 'received' : b.quote_checklist?.find(item => item.item === "Pricing Requested" && item.checked === true) ? 'requested' : 'none';
          const orderA = pricingOrder[pricingStatusA];
          const orderB = pricingOrder[pricingStatusB];
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // Secondary sort by timestamp within same status
          if (pricingStatusA === 'received' || pricingStatusA === 'requested') {
            const itemName = pricingStatusA === 'received' ? 'Pricing Received' : 'Pricing Requested';
            const itemA = a.quote_checklist?.find(item => item.item === itemName && item.checked);
            const itemB = b.quote_checklist?.find(item => item.item === itemName && item.checked);
            const timeA = itemA?.checked_at ? new Date(itemA.checked_at) : new Date(0);
            const timeB = itemB?.checked_at ? new Date(itemB.checked_at) : new Date(0);
            return timeB - timeA; // Descending
          }
          
          // Fallback to creation date
          const dateA = a.created_at || a.created_date || a.createdDate;
          const dateB = b.created_at || b.created_date || b.createdDate;
          return new Date(dateB) - new Date(dateA);
        } else if (sortBy === "created_date") {
          const dateA = a.created_at || a.created_date || a.createdDate;
          const dateB = b.created_at || b.created_date || b.createdDate;
          return new Date(dateB) - new Date(dateA);
        } else if (sortBy === "stage") {
          const stages = ["Lead", "Initial Site Visit", "Create Quote", "Quote Sent", "Quote Approved", "Final Measure", "Parts Ordered", "Scheduled", "Completed", "Warranty"];
          return stages.indexOf(a.status) - stages.indexOf(b.status);
        }
        return 0;
      });
    
    devLog('[Projects] Filter & sort');
    return filtered;
  }, [projects, debouncedSearchTerm, stageFilter, partsStatusFilter, pricingStatusFilter, pricingChecklistFilter, tagFilter, startDate, endDate, sortBy, showDuplicatesOnly, indexes]);

        const getJobCount = useCallback((projectId) => {
          return (indexes.jobsByProjectId.get(projectId) || []).length;
        }, [indexes]);

        const getNextJob = useCallback((projectId) => {
          const projectJobs = (indexes.jobsByProjectId.get(projectId) || []).filter(j => j.scheduled_date);
          const futureJobs = projectJobs.filter(j => new Date(j.scheduled_date) >= new Date());
          if (futureJobs.length === 0) return null;
          return futureJobs.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0];
        }, [indexes]);

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
          return (indexes.tradeReqByProjectId.get(projectId) || []).some(t => t.is_required);
        }, [indexes]);

        const hasCustomerIssue = useCallback((project) => {
          if (!project) return false;
          return !project.customer_id;
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

          <div className="flex items-center gap-3 flex-wrap">
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
            
            {projectTags.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-[#4B5563]">Filter by tag:</Label>
                <div className="flex flex-wrap gap-1">
                  {projectTags.filter(t => t.is_active).map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (tagFilter.includes(tag.id)) {
                          setTagFilter(tagFilter.filter(id => id !== tag.id));
                        } else {
                          setTagFilter([...tagFilter, tag.id]);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        tagFilter.includes(tag.id)
                          ? 'ring-2 ring-offset-1'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ 
                        backgroundColor: tag.color,
                        color: 'white',
                        ringColor: tag.color
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {tagFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTagFilter([])}
                      className="h-7 text-[11px] px-2"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm text-[#4B5563]">Filter by pricing status:</Label>
              <div className="flex flex-wrap gap-1">
                {['Pricing Requested', 'Pricing Received'].map(item => (
                  <button
                    key={item}
                    onClick={() => {
                      if (pricingChecklistFilter.includes(item)) {
                        setPricingChecklistFilter(pricingChecklistFilter.filter(i => i !== item));
                      } else {
                        setPricingChecklistFilter([...pricingChecklistFilter, item]);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      pricingChecklistFilter.includes(item)
                        ? 'bg-[#FAE008] text-[#111827] ring-2 ring-offset-1 ring-[#FAE008]'
                        : 'bg-[#F3F4F6] text-[#4B5563] opacity-60 hover:opacity-100'
                    }`}
                  >
                    {item}
                  </button>
                ))}
                {pricingChecklistFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPricingChecklistFilter([])}
                    className="h-7 text-[11px] px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
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

                  {stageFilter === "Create Quote" && (
                    <Select value={pricingStatusFilter} onValueChange={setPricingStatusFilter}>
                      <SelectTrigger className="w-full md:w-[180px] h-10">
                        <SelectValue placeholder="Pricing Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Pricing</SelectItem>
                        <SelectItem value="pricing_received">Pricing Received</SelectItem>
                        <SelectItem value="pricing_requested">Pricing Requested</SelectItem>
                        <SelectItem value="no_pricing">No Pricing Status</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[200px] h-10">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_date">Order Date (Newest)</SelectItem>
                      <SelectItem value="stage">Project Stage</SelectItem>
                      {stageFilter === "Create Quote" && (
                        <SelectItem value="pricing_status">Pricing Status</SelectItem>
                      )}
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

                  {(stageFilter !== "all" || partsStatusFilter !== "all" || pricingStatusFilter !== "all" || pricingChecklistFilter.length > 0 || startDate || endDate || sortBy !== "created_date") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStageFilter("all");
                        setPartsStatusFilter("all");
                        setPricingStatusFilter("all");
                        setPricingChecklistFilter([]);
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
          {filteredProjects.slice((pageNum - 1) * pageSize, pageNum * pageSize).map((project) => {
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
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <Badge variant="secondary" className="pointer-events-none">
                    #{project.project_number}
                  </Badge>
                  <Badge className={freshnessColors[freshness.color]}>
                    {freshness.label}
                  </Badge>
                  {age !== null && (
                    <span className="text-[12px] text-[#6B7280] bg-white px-2 py-0.5 rounded-lg border border-[#E5E7EB]">
                      {age}d
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-[#F3F4F6]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalProject(project);
                    }}
                  >
                    <Eye className="w-4 h-4 text-[#6B7280]" />
                  </Button>
                </div>
                <CardContent className="p-4">
                  {/* Title row */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 pr-40">
                      <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">{getProjectDisplayTitle(project)}</h3>
                      <DuplicateBadge record={project} size="sm" />
                      {hasCustomerIssue(project) && (
                        <span className="inline-flex items-center gap-1" title="Customer information missing">
                          <UserX className="w-4 h-4 text-[#DC2626]" />
                        </span>
                      )}
                      {(indexes.partsByProjectId.get(project.id) || []).some(detectShortage) && (
                         <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                            Shortage
                         </span>
                       )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <PricingChecklistBadges project={project} />
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
                      <span className="text-[14px] leading-[1.4]">{getProjectCustomerLabel(project)}</span>
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

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E7EB]">
          <div className="text-sm text-[#6B7280]">
            Showing {(pageNum - 1) * pageSize + 1} – {Math.min(pageNum * pageSize, filteredProjects.length)} of {filteredProjects.length} projects
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPageNum(Math.max(1, pageNum - 1))}
              disabled={pageNum === 1}
              className="h-9"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1 px-3 text-sm">
              Page {pageNum} of {Math.ceil(filteredProjects.length / pageSize)}
            </div>
            <Button
              variant="outline"
              onClick={() => setPageNum(pageNum + 1)}
              disabled={pageNum >= Math.ceil(filteredProjects.length / pageSize)}
              className="h-9"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}