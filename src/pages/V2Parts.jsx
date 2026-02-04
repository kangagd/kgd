import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { isPartsLogisticsV2PilotAllowed } from "@/components/utils/allowlist";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Package, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

// Logistics job types to exclude (same as ProjectVisitsTab)
const LOGISTICS_JOB_TYPES = [
  'Parts Pickup',
  'Parts Delivery',
  'Stock Transfer',
  'Warehouse Pickup',
  'Supplier Pickup',
  'Drop Off Parts',
  'Collect Parts'
];

export default function V2Parts() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState("requirements");
  
  // Modal states
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideData, setOverrideData] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const isAllowed = isPartsLogisticsV2PilotAllowed(user);

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'v2parts'],
    queryFn: async () => {
      const allProjects = await base44.entities.Project.list('-updated_date', 200);
      return allProjects;
    },
    enabled: isAllowed,
  });

  // Fetch visit targets (combined jobs + job summaries) for selected project
  const { data: visitTargets = [] } = useQuery({
    queryKey: ['visitTargets', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const [jobs, summaries] = await Promise.all([
        base44.entities.Job.filter({ project_id: selectedProjectId }, '-scheduled_date'),
        base44.entities.JobSummary.filter({ project_id: selectedProjectId }, '-check_out_time'),
      ]);
      
      console.log('[visitTargets] Raw jobs returned:', jobs.length);
      console.log('[visitTargets] Sample job data:', jobs.slice(0, 2).map(j => ({ 
        id: j.id, 
        job_number: j.job_number, 
        project_id: j.project_id,
        deleted_at: j.deleted_at,
        job_type_name: j.job_type_name
      })));
      
      // Check specifically for #5141-A
      const job5141A = jobs.find(j => j.job_number === '5141-A');
      console.log('[visitTargets] Job #5141-A found in raw results?', !!job5141A);
      if (job5141A) {
        console.log('[visitTargets] #5141-A details:', {
          id: job5141A.id,
          project_id: job5141A.project_id,
          deleted_at: job5141A.deleted_at,
          job_type_name: job5141A.job_type_name,
          is_logistics_job: job5141A.is_logistics_job
        });
      }
      console.log('[visitTargets] selectedProjectId being queried:', selectedProjectId);
      
      // Filter out deleted and logistics job types
      const filteredJobs = jobs.filter(job => 
        !job.deleted_at && 
        !LOGISTICS_JOB_TYPES.includes(job.job_type_name)
      );
      
      console.log('[visitTargets] Filtered jobs:', filteredJobs.length);
      console.log('[visitTargets] Job #5141-A in filtered results?', !!filteredJobs.find(j => j.job_number === '5141-A'));
      
      const filteredSummaries = summaries.filter(s =>
        !s.deleted_at &&
        !LOGISTICS_JOB_TYPES.includes(s.job_type_name)
      );
      
      // Build unified targets, preferring jobs over summaries
      const targetsByJobId = {};
      
      // Add jobs first
      filteredJobs.forEach(job => {
        const label = `Job #${job.job_number || job.id} — ${job.job_type_name || 'Job'} — ${job.scheduled_date || ''}`.trim();
        targetsByJobId[job.id] = {
          job_id: job.id,
          id: job.id,
          kind: 'job',
          label,
          sortDate: job.scheduled_date,
          job_number: job.job_number,
          job_type_name: job.job_type_name,
          scheduled_date: job.scheduled_date,
        };
      });
      
      // Add summaries (only if not already a job)
      filteredSummaries.forEach(s => {
        if (!targetsByJobId[s.job_id]) {
          const label = `Visit (checked out) — Job #${s.job_number || s.job_id} — ${s.check_out_time || ''}`.trim();
          targetsByJobId[s.job_id] = {
            job_id: s.job_id,
            id: s.job_id,
            kind: 'summary',
            label,
            sortDate: s.check_out_time,
            job_number: s.job_number,
            job_type_name: s.job_type_name,
            check_out_time: s.check_out_time,
          };
        }
      });
      
      // Sort by date descending
      const targets = Object.values(targetsByJobId)
        .sort((a, b) => {
          if (!a.sortDate && !b.sortDate) return 0;
          if (!a.sortDate) return 1;
          if (!b.sortDate) return -1;
          return new Date(b.sortDate) - new Date(a.sortDate);
        });
      
      return targets;
    },
    enabled: !!selectedProjectId && isAllowed,
  });

  // Fetch requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ['projectRequirementLines', selectedProjectId],
    queryFn: async () => {
      return await base44.entities.ProjectRequirementLine.filter({ project_id: selectedProjectId });
    },
    enabled: !!selectedProjectId && isAllowed,
  });

  // Fetch allocations
  const { data: allocations = [] } = useQuery({
    queryKey: ['stockAllocations', selectedProjectId],
    queryFn: async () => {
      return await base44.entities.StockAllocation.filter({ project_id: selectedProjectId });
    },
    enabled: !!selectedProjectId && isAllowed,
  });

  // Fetch usage
  const { data: consumptions = [] } = useQuery({
    queryKey: ['stockConsumptions', selectedProjectId],
    queryFn: async () => {
      return await base44.entities.StockConsumption.filter({ project_id: selectedProjectId });
    },
    enabled: !!selectedProjectId && isAllowed,
  });

  // Fetch price list items for catalog search
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
    enabled: isAllowed,
  });

  // Fetch inventory locations
  const { data: inventoryLocations = [] } = useQuery({
    queryKey: ['inventoryLocations'],
    queryFn: () => base44.entities.InventoryLocation.list(),
    enabled: isAllowed,
  });

  // Compute readiness summary
  const readinessSummary = useMemo(() => {
    const blockingLines = requirements.filter(r => r.is_blocking);
    const totalRequired = requirements.reduce((sum, r) => sum + (r.qty_required || 0), 0);
    const totalAllocated = allocations
      .filter(a => a.status !== 'released')
      .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
    
    const blockingMissing = blockingLines.filter(line => {
      const lineAllocated = allocations
        .filter(a => a.requirement_line_id === line.id && a.status !== 'released')
        .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
      return lineAllocated < line.qty_required;
    });

    return {
      totalLines: requirements.length,
      blockingLines: blockingLines.length,
      totalRequired,
      totalAllocated,
      blockingMissing: blockingMissing.length,
    };
  }, [requirements, allocations]);

  // Mutations
  const createRequirementMutation = useMutation({
    mutationFn: (data) => base44.entities.ProjectRequirementLine.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', selectedProjectId]);
      setRequirementModalOpen(false);
      toast.success('Requirement created');
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectRequirementLine.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', selectedProjectId]);
      setRequirementModalOpen(false);
      setEditingRequirement(null);
      toast.success('Requirement updated');
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectRequirementLine.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', selectedProjectId]);
      toast.success('Requirement deleted');
    },
  });

  const createAllocationMutation = useMutation({
    mutationFn: (data) => base44.entities.StockAllocation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockAllocations', selectedProjectId]);
      setAllocationModalOpen(false);
      toast.success('Allocation created');
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StockAllocation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockAllocations', selectedProjectId]);
      toast.success('Allocation updated');
    },
  });

  const createConsumptionMutation = useMutation({
    mutationFn: (data) => base44.entities.StockConsumption.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockConsumptions', selectedProjectId]);
      setUsageModalOpen(false);
      toast.success('Usage recorded');
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Not Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">This feature is not available for your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Top Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Parts (V2) — Pilot</h1>
              <p className="text-sm text-gray-600">Project-level requirements, allocations, and usage</p>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-md">
            <Label>Select Project</Label>
            <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => {
                  const projectNum = p.project_number || p.projectNumber || p.number || '?';
                  const projectTitle = p.title || p.name || p.project_name || p.address || p.client_name || 'Untitled';
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      #{projectNum} - {projectTitle}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Loaded projects: {projects.length}</p>
          </div>
        </div>
      </div>

      {!selectedProjectId && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Select a project to view requirements and allocations</p>
          </CardContent>
        </Card>
      )}

      {selectedProjectId && (
        <>
          {/* Readiness Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Readiness Summary</CardTitle>
              <CardDescription>Allocation-based readiness (Received + SLA: coming soon)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-2xl font-bold">{readinessSummary.totalLines}</div>
                  <div className="text-sm text-gray-600">Total Lines</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{readinessSummary.blockingLines}</div>
                  <div className="text-sm text-gray-600">Blocking</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{readinessSummary.totalAllocated}/{readinessSummary.totalRequired}</div>
                  <div className="text-sm text-gray-600">Allocated/Required</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{readinessSummary.blockingMissing}</div>
                  <div className="text-sm text-gray-600">Blocking Missing</div>
                </div>
                <div>
                  <Badge variant="outline" className="text-xs">Received: Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="allocations">Allocations</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            {/* Requirements Tab */}
            <TabsContent value="requirements" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Requirements</CardTitle>
                    <Button onClick={() => { setEditingRequirement(null); setRequirementModalOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Requirement
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {requirements.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No requirements yet</p>
                  ) : (
                    <div className="space-y-2">
                     {requirements.map(req => {
                       const allocated = allocations
                         .filter(a => a.requirement_line_id === req.id && a.status !== 'released')
                         .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
                       const remaining = Math.max(0, req.qty_required - allocated);

                       // Resolve display label
                       let displayLabel = 'Unknown item';
                       let secondaryText = null;

                       if (req.catalog_item_name) {
                         displayLabel = req.catalog_item_name;
                         // Try to get SKU if available
                         const catalogItem = priceListItems.find(p => p.id === req.catalog_item_id);
                         if (catalogItem?.sku) {
                           secondaryText = `SKU: ${catalogItem.sku}`;
                         }
                       } else if (req.description) {
                         displayLabel = req.description;
                       } else if (req.catalog_item_id && priceListItems.length > 0) {
                         const catalogItem = priceListItems.find(p => p.id === req.catalog_item_id);
                         if (catalogItem) {
                           displayLabel = catalogItem.item;
                           if (catalogItem.sku) {
                             secondaryText = `SKU: ${catalogItem.sku}`;
                           }
                         }
                       }

                       return (
                         <div key={req.id} className="border rounded-lg p-4 flex justify-between items-start">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                               <span className="font-medium">{displayLabel}</span>
                               {req.is_blocking && <Badge variant="destructive" className="text-xs">Blocking</Badge>}
                               <Badge variant="outline" className="text-xs">{req.priority}</Badge>
                               <Badge className="text-xs">{req.status}</Badge>
                             </div>
                             {secondaryText && (
                               <div className="text-xs text-gray-500 font-mono">{secondaryText}</div>
                             )}
                             <div className="text-sm text-gray-600">
                               Required: {req.qty_required} | Allocated: {allocated} | Remaining: {remaining}
                             </div>
                             {req.notes && <div className="text-sm text-gray-500 mt-1">{req.notes}</div>}
                             {req.catalog_item_id && (
                               <div className="text-xs text-gray-400 font-mono mt-1">ID: {req.catalog_item_id.slice(-6)}</div>
                             )}
                           </div>
                           <div className="flex gap-2">
                             <Button variant="ghost" size="sm" onClick={() => { setEditingRequirement(req); setRequirementModalOpen(true); }}>
                               <Pencil className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="sm" onClick={() => {
                               if (confirm('Delete this requirement?')) deleteRequirementMutation.mutate(req.id);
                             }}>
                               <Trash2 className="w-4 h-4 text-red-600" />
                             </Button>
                           </div>
                         </div>
                       );
                     })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Allocations Tab */}
            <TabsContent value="allocations" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Allocations</CardTitle>
                    <Button onClick={() => setAllocationModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Allocation
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {allocations.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No allocations yet</p>
                  ) : (
                    <div className="space-y-4">
                      {['unassigned', ...visitTargets.map(j => j.job_id)].map(jobId => {
                        const jobAllocations = allocations.filter(a => 
                          jobId === 'unassigned' ? !a.job_id : a.job_id === jobId
                        );
                        if (jobAllocations.length === 0) return null;

                        const target = visitTargets.find(j => j.job_id === jobId);
                        const jobLabel = jobId === 'unassigned' 
                          ? 'Unassigned'
                          : target?.label || `Job: ${jobId}`;

                        return (
                          <div key={jobId}>
                            <h4 className="font-medium mb-2">{jobLabel}</h4>
                            <div className="space-y-2">
                              {jobAllocations.map(alloc => (
                                <div key={alloc.id} className="border rounded-lg p-3 flex justify-between items-center">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{alloc.description || alloc.catalog_item_id}</span>
                                      <Badge className="text-xs">{alloc.status}</Badge>
                                    </div>
                                    <div className="text-sm text-gray-600">Qty: {alloc.qty_allocated}</div>
                                  </div>
                                  <div className="flex gap-2">
                                    {alloc.status === 'reserved' && (
                                      <Button size="sm" onClick={() => updateAllocationMutation.mutate({ id: alloc.id, data: { status: 'loaded' } })}>
                                        Mark Loaded
                                      </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => updateAllocationMutation.mutate({ id: alloc.id, data: { status: 'released' } })}>
                                      Release
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Usage</CardTitle>
                    <Button onClick={() => setUsageModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Usage
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {consumptions.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No usage recorded yet</p>
                  ) : (
                    <div className="space-y-4">
                      {['unassigned', ...visitTargets.map(j => j.job_id)].map(jobId => {
                        const jobConsumptions = consumptions.filter(c => 
                          jobId === 'unassigned' ? !c.job_id : c.job_id === jobId
                        );
                        if (jobConsumptions.length === 0) return null;

                        const target = visitTargets.find(j => j.job_id === jobId);
                        const jobLabel = jobId === 'unassigned' 
                          ? 'Unassigned'
                          : target?.label || `Job: ${jobId}`;
                        
                        return (
                          <div key={jobId}>
                            <h4 className="font-medium mb-2">{jobLabel}</h4>
                            <div className="space-y-2">
                              {jobConsumptions.map(cons => (
                                <div key={cons.id} className="border rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{cons.description || cons.catalog_item_id}</span>
                                    {!cons.source_allocation_id && <Badge variant="outline" className="text-xs">Unallocated</Badge>}
                                  </div>
                                  <div className="text-sm text-gray-600">Qty: {cons.qty_consumed}</div>
                                  {cons.notes && <div className="text-sm text-gray-500 mt-1">{cons.notes}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Requirement Modal */}
          <RequirementModal
            open={requirementModalOpen}
            onClose={() => { setRequirementModalOpen(false); setEditingRequirement(null); }}
            requirement={editingRequirement}
            projectId={selectedProjectId}
            priceListItems={priceListItems}
            onSubmit={(data) => {
              if (editingRequirement) {
                updateRequirementMutation.mutate({ id: editingRequirement.id, data });
              } else {
                createRequirementMutation.mutate({ ...data, project_id: selectedProjectId });
              }
            }}
          />

          {/* Allocation Modal */}
          <AllocationModal
            open={allocationModalOpen}
            onClose={() => setAllocationModalOpen(false)}
            projectId={selectedProjectId}
            requirements={requirements}
            visitTargets={visitTargets}
            priceListItems={priceListItems}
            allocations={allocations}
            locations={inventoryLocations}
            user={user}
            onSubmit={(data) => {
              const requirement = requirements.find(r => r.id === data.requirement_line_id);
              if (requirement) {
                const currentAllocated = allocations
                  .filter(a => a.requirement_line_id === requirement.id && a.status !== 'released')
                  .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
                const newTotal = currentAllocated + data.qty_allocated;
                
                if (newTotal > requirement.qty_required) {
                  setOverrideData({ type: 'allocation', data, requirement, newTotal });
                  setOverrideModalOpen(true);
                  return;
                }
              }
              
              // Snapshot catalog item name for allocation
              let allocationData = {
                ...data,
                project_id: selectedProjectId,
                visit_id: null,
                allocated_by_user_id: user?.id,
                allocated_by_name: user?.full_name || user?.email,
                allocated_at: new Date().toISOString(),
              };

              // If against requirement, inherit catalog details
              if (data.requirement_line_id) {
                const req = requirements.find(r => r.id === data.requirement_line_id);
                if (req) {
                  allocationData.catalog_item_id = req.catalog_item_id || req.price_list_item_id || null;
                  allocationData.catalog_item_name = req.catalog_item_name || req.description || null;
                }
              } else if (data.catalog_item_id) {
                // Ad-hoc: snapshot from selected item
                const selectedItem = priceListItems.find(p => p.id === data.catalog_item_id);
                if (selectedItem) {
                  allocationData.catalog_item_name = selectedItem.item || selectedItem.name || selectedItem.title || null;
                }
              }

              createAllocationMutation.mutate(allocationData);
            }}
          />

          {/* Usage Modal */}
          <UsageModal
            open={usageModalOpen}
            onClose={() => setUsageModalOpen(false)}
            projectId={selectedProjectId}
            visitTargets={visitTargets}
            allocations={allocations}
            priceListItems={priceListItems}
            onSubmit={(data) => {
              if (data.source_allocation_id) {
                const allocation = allocations.find(a => a.id === data.source_allocation_id);
                const consumedFromAlloc = consumptions
                  .filter(c => c.source_allocation_id === allocation.id)
                  .reduce((sum, c) => sum + (c.qty_consumed || 0), 0);
                const remaining = allocation.qty_allocated - consumedFromAlloc;
                
                if (data.qty_consumed > remaining) {
                  setOverrideData({ type: 'consumption', data, allocation, remaining });
                  setOverrideModalOpen(true);
                  return;
                }
              }
              
              createConsumptionMutation.mutate({
                ...data,
                project_id: selectedProjectId,
                visit_id: null,
                consumed_by_user_id: user?.id,
                consumed_by_name: user?.full_name || user?.email,
                consumed_at: new Date().toISOString(),
              });
            }}
          />

          {/* Override Confirmation Modal */}
          <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override Warning</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                {overrideData?.type === 'allocation' && (
                  <p>This allocation would exceed the requirement. Required: {overrideData.requirement.qty_required}, New Total: {overrideData.newTotal}</p>
                )}
                {overrideData?.type === 'consumption' && (
                  <p>This consumption would exceed the allocation. Remaining: {overrideData.remaining}, Requested: {overrideData.data.qty_consumed}</p>
                )}
                <p className="mt-2 text-sm text-red-600">Admin override required. Continue?</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (overrideData?.type === 'allocation') {
                    createAllocationMutation.mutate({
                      ...overrideData.data,
                      project_id: selectedProjectId,
                      visit_id: null,
                      allocated_by_user_id: user?.id,
                      allocated_by_name: user?.full_name || user?.email,
                      allocated_at: new Date().toISOString(),
                    });
                  } else if (overrideData?.type === 'consumption') {
                    createConsumptionMutation.mutate({
                      ...overrideData.data,
                      project_id: selectedProjectId,
                      visit_id: null,
                      consumed_by_user_id: user?.id,
                      consumed_by_name: user?.full_name || user?.email,
                      consumed_at: new Date().toISOString(),
                    });
                  }
                  setOverrideModalOpen(false);
                  setOverrideData(null);
                  if (overrideData?.type === 'allocation') setAllocationModalOpen(false);
                  if (overrideData?.type === 'consumption') setUsageModalOpen(false);
                }}>
                  Override & Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

// Requirement Modal Component
function RequirementModal({ open, onClose, requirement, projectId, priceListItems, onSubmit }) {
  const [formData, setFormData] = useState({
    catalog_item_id: '',
    description: '',
    qty_required: 1,
    is_blocking: true,
    priority: 'main',
    notes: '',
    status: 'planned',
  });
  const [isAdHoc, setIsAdHoc] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (requirement) {
      setFormData({
        catalog_item_id: requirement.catalog_item_id || '',
        description: requirement.description || '',
        qty_required: requirement.qty_required || 1,
        is_blocking: requirement.is_blocking !== undefined ? requirement.is_blocking : true,
        priority: requirement.priority || 'main',
        notes: requirement.notes || '',
        status: requirement.status || 'planned',
      });
      setIsAdHoc(!requirement.catalog_item_id);
    } else {
      setFormData({
        catalog_item_id: '',
        description: '',
        qty_required: 1,
        is_blocking: true,
        priority: 'main',
        notes: '',
        status: 'planned',
      });
      setIsAdHoc(false);
    }
  }, [requirement, open]);

  const filteredItems = priceListItems.filter(item =>
    item.item?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{requirement ? 'Edit' : 'Add'} Requirement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Item Type</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!isAdHoc} onChange={() => setIsAdHoc(false)} />
                <span>Catalog Item</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={isAdHoc} onChange={() => setIsAdHoc(true)} />
                <span>Ad-hoc</span>
              </label>
            </div>
          </div>

          {!isAdHoc ? (
            <div>
              <Label>Search Catalog Item</Label>
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
              />
              <Select value={formData.catalog_item_id} onValueChange={(val) => setFormData({ ...formData, catalog_item_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose item..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Item description"
              />
            </div>
          )}

          <div>
            <Label>Quantity Required</Label>
            <Input
              type="number"
              min="1"
              value={formData.qty_required}
              onChange={(e) => setFormData({ ...formData, qty_required: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_blocking}
              onCheckedChange={(checked) => setFormData({ ...formData, is_blocking: checked })}
            />
            <Label>Blocking (required for project completion)</Label>
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="hardware">Hardware</SelectItem>
                <SelectItem value="nice_to_have">Nice to Have</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!isAdHoc && !formData.catalog_item_id) {
              toast.error('Please select a catalog item');
              return;
            }
            if (isAdHoc && !formData.description) {
              toast.error('Please enter a description');
              return;
            }

            let submitData = isAdHoc ? { ...formData, catalog_item_id: null } : { ...formData, description: null };

            // Snapshot catalog_item_name when creating/updating requirement with catalog_item_id
            if (!isAdHoc && formData.catalog_item_id) {
              const selectedItem = priceListItems.find(p => p.id === formData.catalog_item_id);
              if (selectedItem) {
                submitData.catalog_item_name = selectedItem.item || selectedItem.name || selectedItem.title || null;
              }
            }

            onSubmit(submitData);
          }}>
            {requirement ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to shorten IDs
function shortenId(id) {
  if (!id || typeof id !== 'string') return '???';
  return id.substring(id.length - 6);
}

// Allocation Modal Component
function AllocationModal({ open, onClose, projectId, requirements, visitTargets = [], priceListItems, allocations, user, onSubmit, locations = [] }) {
  const [formData, setFormData] = useState({
    requirement_line_id: '',
    job_id: '',
    qty_allocated: 1,
    status: 'reserved',
    from_location_id: '',
    catalog_item_id: '',
    description: '',
  });
  const [mode, setMode] = useState('requirement'); // 'requirement' or 'adhoc'

  useEffect(() => {
    if (open) {
      setFormData({
        requirement_line_id: '',
        job_id: '',
        qty_allocated: 1,
        status: 'reserved',
        from_location_id: '',
        catalog_item_id: '',
        description: '',
      });
      setMode('requirement');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Allocation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Allocation Mode</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'requirement'} onChange={() => setMode('requirement')} />
                <span>Against Requirement</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'adhoc'} onChange={() => setMode('adhoc')} />
                <span>Ad-hoc</span>
              </label>
            </div>
          </div>

          {mode === 'requirement' ? (
            <div>
              <Label>Requirement Line</Label>
              <Select value={formData.requirement_line_id} onValueChange={(val) => setFormData({ ...formData, requirement_line_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {requirements.map(req => (
                    <SelectItem key={req.id} value={req.id}>
                      {req.description || req.catalog_item_id} (Req: {req.qty_required})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label>Catalog Item (optional)</Label>
                <Select value={formData.catalog_item_id} onValueChange={(val) => setFormData({ ...formData, catalog_item_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priceListItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item description"
                />
              </div>
            </>
          )}

          <div>
            <Label>From Location (optional)</Label>
            <Select value={formData.from_location_id} onValueChange={(val) => setFormData({ ...formData, from_location_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Job (Required)</Label>
            <Select value={formData.job_id} onValueChange={(val) => setFormData({ ...formData, job_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose job..." />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-auto">
                {visitTargets.map(t => (
                  <SelectItem key={t.job_id} value={t.job_id}>
                    {t.label || t.job_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Targets loaded: {visitTargets.length}</p>
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={formData.qty_allocated}
              onChange={(e) => setFormData({ ...formData, qty_allocated: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!formData.job_id) {
              toast.error('Please select a job');
              return;
            }
            if (mode === 'requirement' && !formData.requirement_line_id) {
              toast.error('Please select a requirement line');
              return;
            }
            if (mode === 'adhoc' && !formData.description && !formData.catalog_item_id) {
              toast.error('Please provide catalog item or description');
              return;
            }
            onSubmit(mode === 'requirement' 
              ? { ...formData, catalog_item_id: null, description: null, visit_id: null, from_location_id: formData.from_location_id || null }
              : { ...formData, requirement_line_id: null, visit_id: null, from_location_id: formData.from_location_id || null }
            );
          }}>
            Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Usage Modal Component
function UsageModal({ open, onClose, projectId, visitTargets, allocations, priceListItems, onSubmit }) {
  const [formData, setFormData] = useState({
    job_id: '',
    catalog_item_id: '',
    description: '',
    qty_consumed: 1,
    source_allocation_id: '',
    notes: '',
  });
  const [mode, setMode] = useState('allocated'); // 'allocated' or 'adhoc'

  useEffect(() => {
    if (open) {
      setFormData({
        job_id: '',
        catalog_item_id: '',
        description: '',
        qty_consumed: 1,
        source_allocation_id: '',
        notes: '',
      });
      setMode('allocated');
    }
  }, [open]);

  const jobAllocations = formData.job_id 
    ? allocations.filter(a => a.job_id === formData.job_id && a.status !== 'released')
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Usage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Job (Required)</Label>
            <Select value={formData.job_id} onValueChange={(val) => setFormData({ ...formData, job_id: val, source_allocation_id: '' })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose job..." />
              </SelectTrigger>
              <SelectContent>
                {visitTargets.map(t => (
                  <SelectItem key={t.job_id} value={t.job_id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
          </div>

          <div>
            <Label>Usage Mode</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'allocated'} onChange={() => setMode('allocated')} />
                <span>From Allocation</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === 'adhoc'} onChange={() => setMode('adhoc')} />
                <span>Ad-hoc</span>
              </label>
            </div>
          </div>

          {mode === 'allocated' ? (
            <div>
              <Label>Source Allocation</Label>
              <Select value={formData.source_allocation_id} onValueChange={(val) => setFormData({ ...formData, source_allocation_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose allocation..." />
                </SelectTrigger>
                <SelectContent>
                  {jobAllocations.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.description || a.catalog_item_id} (Qty: {a.qty_allocated})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label>Catalog Item (optional)</Label>
                <Select value={formData.catalog_item_id} onValueChange={(val) => setFormData({ ...formData, catalog_item_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priceListItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item description"
                />
              </div>
            </>
          )}

          <div>
            <Label>Quantity Consumed</Label>
            <Input
              type="number"
              min="1"
              value={formData.qty_consumed}
              onChange={(e) => setFormData({ ...formData, qty_consumed: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!formData.job_id) {
              toast.error('Please select a job');
              return;
            }
            if (mode === 'allocated' && !formData.source_allocation_id) {
              toast.error('Please select an allocation');
              return;
            }
            if (mode === 'adhoc' && !formData.description && !formData.catalog_item_id) {
              toast.error('Please provide catalog item or description');
              return;
            }
            onSubmit(mode === 'allocated'
              ? { ...formData, catalog_item_id: null, description: null, visit_id: null }
              : { ...formData, source_allocation_id: null, visit_id: null }
            );
          }}>
            Record Usage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}