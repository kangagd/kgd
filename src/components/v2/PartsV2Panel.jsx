import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Truck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isPartsLogisticsV2PilotAllowed } from "@/components/utils/allowlist";

const LOGISTICS_JOB_TYPES = [
  'Parts Pickup',
  'Parts Delivery',
  'Stock Transfer',
  'Warehouse Pickup',
  'Supplier Pickup',
  'Drop Off Parts',
  'Collect Parts'
];

export default function PartsV2Panel({ projectId, jobId = null, visitId = null }) {
  const [activeTab, setActiveTab] = useState("requirements");
  const [user, setUser] = useState(null);
  
  // Modal states
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideData, setOverrideData] = useState(null);
  const [quickActionJobId, setQuickActionJobId] = useState(jobId);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (jobId) {
      setQuickActionJobId(jobId);
    }
  }, [jobId]);

  // Fetch jobs for project (for grouping)
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const allJobs = await base44.entities.Job.filter({ project_id: projectId });
      return allJobs.filter(j => !j.deleted_at && !LOGISTICS_JOB_TYPES.includes(j.job_type_name));
    },
    enabled: !!projectId && !jobId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ['projectRequirementLines', projectId],
    queryFn: async () => {
      return await base44.entities.ProjectRequirementLine.filter({ project_id: projectId });
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch allocations
  const { data: allocations = [] } = useQuery({
    queryKey: ['stockAllocations', projectId],
    queryFn: async () => {
      return await base44.entities.StockAllocation.filter({ project_id: projectId });
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch usage
  const { data: consumptions = [] } = useQuery({
    queryKey: ['stockConsumptions', projectId],
    queryFn: async () => {
      return await base44.entities.StockConsumption.filter({ project_id: projectId });
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch price list items for catalog search
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Scoped filtering
  const scopedAllocations = jobId ? allocations.filter(a => a.job_id === jobId) : allocations;
  const scopedConsumptions = jobId ? consumptions.filter(c => c.job_id === jobId) : consumptions;

  // Compute readiness summary
  const readinessSummary = useMemo(() => {
    const blockingLines = requirements.filter(r => r.is_blocking);
    const totalRequired = requirements.reduce((sum, r) => sum + (r.qty_required || 0), 0);
    const totalAllocated = scopedAllocations
      .filter(a => a.status !== 'released')
      .reduce((sum, a) => sum + (a.qty_allocated || 0), 0);
    
    const blockingMissing = blockingLines.filter(line => {
      const lineAllocated = scopedAllocations
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
  }, [requirements, scopedAllocations]);

  // Mutations
  const createRequirementMutation = useMutation({
    mutationFn: (data) => base44.entities.ProjectRequirementLine.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', projectId]);
      setRequirementModalOpen(false);
      toast.success('Requirement created');
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectRequirementLine.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', projectId]);
      setRequirementModalOpen(false);
      setEditingRequirement(null);
      toast.success('Requirement updated');
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectRequirementLine.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirementLines', projectId]);
      toast.success('Requirement deleted');
    },
  });

  const createAllocationMutation = useMutation({
    mutationFn: (data) => base44.entities.StockAllocation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockAllocations', projectId]);
      setAllocationModalOpen(false);
      toast.success('Allocation created');
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StockAllocation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockAllocations', projectId]);
      toast.success('Allocation updated');
    },
  });

  const createConsumptionMutation = useMutation({
    mutationFn: (data) => base44.entities.StockConsumption.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockConsumptions', projectId]);
      setUsageModalOpen(false);
      toast.success('Usage recorded');
    },
  });

  const createLogisticsRunMutation = useMutation({
    mutationFn: async ({ jobId, visitId: currentVisitId }) => {
      // Load job details to prefill context
      const job = await base44.entities.Job.get(jobId);
      
      // Get allocations for this job
      const jobAllocations = allocations.filter(a => 
        a.job_id === jobId && 
        a.status !== 'released'
      );
      const allocationIds = jobAllocations.map(a => a.id);

      // Build intent key for idempotency (inline helpers)
      const stableSortedIds = (ids) => [...ids].sort();
      const hashIds = (ids) => {
        const sorted = stableSortedIds(ids);
        const joined = sorted.join('|');
        return btoa(joined).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const targetVehicleId = job.vehicle_id || null;
      const targetLocationId = null; // Not specified in parts flow
      const hash = hashIds(allocationIds);
      const visit = currentVisitId || 'none';
      const vehicle = targetVehicleId || 'none';
      const location = targetLocationId || 'none';
      const intent_key = `parts_allocations:${visit}:${vehicle}:${location}:${hash}`;
      const intent_kind = 'parts_allocations';
      const intent_meta_json = JSON.stringify({ 
        allocation_ids: allocationIds,
        visit_id: currentVisitId || null,
        job_id: jobId 
      });

      // Infer scheduling from job
      let scheduledStart = null;
      if (job.scheduled_date && job.scheduled_time) {
        scheduledStart = `${job.scheduled_date}T${job.scheduled_time}`;
      } else if (job.scheduled_date) {
        scheduledStart = `${job.scheduled_date}T09:00:00`;
      }

      // Prepare run draft data
      const runDraftData = {
        assigned_to_user_id: job.assigned_to?.[0] || null,
        assigned_to_name: job.assigned_to_name?.[0] || null,
        vehicle_id: targetVehicleId,
        scheduled_start: scheduledStart,
        notes: `Auto-created from Parts (V2) allocations for Job ${job.job_number || job.id}`,
      };

      // Prepare stops draft data
      const stopsDraftData = [
        {
          purpose: "storage_to_vehicle",
          project_id: job.project_id,
          requires_photos: false,
          instructions: "Load allocated parts into vehicle",
        },
        {
          purpose: "vehicle_to_site",
          project_id: job.project_id,
          requires_photos: false,
          instructions: "Deliver parts to site for install",
        },
      ];

      // Use get-or-create function
      const result = await base44.functions.invoke('getOrCreateLogisticsRun', {
        intent_key,
        intent_kind,
        intent_meta_json,
        runDraftData,
        stopsDraftData
      });

      if (!result.data?.run) {
        throw new Error('Failed to get or create run');
      }

      return result.data.run;
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries(['logisticsRuns']);
      toast.success('Draft run created', {
        action: {
          label: 'Open in Logistics (V2)',
          onClick: () => navigate(createPageUrl("V2Logistics") + `?runId=${run.id}`),
        },
      });
    },
    onError: () => {
      toast.error('Failed to create logistics run');
    },
  });

  return (
    <div className="space-y-4">
      {/* Quick Actions for Job Context */}
      {jobId && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-900">Quick Actions for This Job</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" onClick={() => { setQuickActionJobId(jobId); setAllocationModalOpen(true); }}>
              Allocate to This Job
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setQuickActionJobId(jobId); setUsageModalOpen(true); }}>
              Add Usage for This Job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Readiness Summary */}
      <Card>
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
                    return (
                      <div key={req.id} className="border rounded-lg p-4 flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{req.description || req.catalog_item_id}</span>
                            {req.is_blocking && <Badge variant="destructive" className="text-xs">Blocking</Badge>}
                            <Badge variant="outline" className="text-xs">{req.priority}</Badge>
                            <Badge className="text-xs">{req.status}</Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Required: {req.qty_required} | Allocated: {allocated} | Remaining: {remaining}
                          </div>
                          {req.notes && <div className="text-sm text-gray-500 mt-1">{req.notes}</div>}
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
                <CardTitle>Allocations {jobId && '(This Job)'}</CardTitle>
                <Button onClick={() => { setQuickActionJobId(jobId); setAllocationModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Allocation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scopedAllocations.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No allocations yet</p>
              ) : (
                <AllocationsGroupedByJob 
                  allocations={scopedAllocations}
                  jobs={jobs}
                  jobId={jobId}
                  user={user}
                  createLogisticsRunMutation={createLogisticsRunMutation}
                  updateAllocationMutation={updateAllocationMutation}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Usage {jobId && '(This Job)'}</CardTitle>
                <Button onClick={() => { setQuickActionJobId(jobId); setUsageModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Usage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scopedConsumptions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No usage recorded yet</p>
              ) : (
                <UsageGroupedByJob 
                  consumptions={scopedConsumptions}
                  jobs={jobs}
                  jobId={jobId}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RequirementModal
        open={requirementModalOpen}
        onClose={() => { setRequirementModalOpen(false); setEditingRequirement(null); }}
        requirement={editingRequirement}
        projectId={projectId}
        priceListItems={priceListItems}
        onSubmit={(data) => {
          if (editingRequirement) {
            updateRequirementMutation.mutate({ id: editingRequirement.id, data });
          } else {
            createRequirementMutation.mutate({ ...data, project_id: projectId });
          }
        }}
      />

      <AllocationModal
        open={allocationModalOpen}
        onClose={() => setAllocationModalOpen(false)}
        projectId={projectId}
        requirements={requirements}
        jobs={jobs}
        priceListItems={priceListItems}
        allocations={allocations}
        preselectedJobId={quickActionJobId}
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
          
          createAllocationMutation.mutate({
            ...data,
            project_id: projectId,
            allocated_by_user_id: user?.id,
            allocated_by_name: user?.full_name || user?.email,
            allocated_at: new Date().toISOString(),
          });
        }}
      />

      <UsageModal
        open={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        projectId={projectId}
        visitId={visitId}
        jobs={jobs}
        allocations={allocations}
        priceListItems={priceListItems}
        consumptions={consumptions}
        preselectedJobId={quickActionJobId}
        onSubmit={async (data) => {
          // Use backend function for visit consumption with allocation
          if (visitId && data.source_allocation_id) {
            try {
              const result = await base44.functions.invoke('recordVisitConsumption', {
                project_id: projectId,
                visit_id: visitId,
                source_allocation_id: data.source_allocation_id,
                qty_consumed: data.qty_consumed,
                notes: data.notes
              });
              
              if (result.data?.success) {
                queryClient.invalidateQueries(['stockConsumptions', projectId]);
                setUsageModalOpen(false);
                toast.success('Usage recorded');
              } else {
                toast.error(result.data?.error || 'Failed to record usage');
              }
            } catch (error) {
              toast.error(error.message || 'Failed to record usage');
            }
            return;
          }
          
          // Fallback: direct entity creation for non-visit or ad-hoc usage
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
            project_id: projectId,
            visit_id: visitId || data.visit_id || null,
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
                  project_id: projectId,
                  allocated_by_user_id: user?.id,
                  allocated_by_name: user?.full_name || user?.email,
                  allocated_at: new Date().toISOString(),
                });
              } else if (overrideData?.type === 'consumption') {
                createConsumptionMutation.mutate({
                  ...overrideData.data,
                  project_id: projectId,
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
    </div>
  );
}

// Allocations Grouped By Job
function AllocationsGroupedByJob({ allocations, jobs, jobId, user, createLogisticsRunMutation, updateAllocationMutation }) {
  const jobIds = Array.from(new Set(allocations.map(a => a.job_id).filter(Boolean)));
  const groups = ['unassigned', ...jobIds];
  const canCreateRun = user && isPartsLogisticsV2PilotAllowed(user);

  return (
    <div className="space-y-4">
      {groups.map(groupKey => {
        const jobAllocations = groupKey === 'unassigned'
          ? allocations.filter(a => !a.job_id)
          : allocations.filter(a => a.job_id === groupKey);
        
        if (jobAllocations.length === 0) return null;

        const job = jobs.find(j => j.id === groupKey);
        const isCurrentJob = groupKey === jobId;
        const jobLabel = groupKey === 'unassigned' 
          ? 'Unassigned' 
          : jobId 
            ? 'This Job'
            : job 
              ? `Job #${job.job_number} — ${job.job_type_name || 'Job'}`
              : `Job: ...${groupKey.substring(groupKey.length - 6)}`;

        return (
          <div key={groupKey} className={isCurrentJob ? 'border-2 border-blue-300 rounded-lg p-2' : ''}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">
                {jobLabel}
                {isCurrentJob && <Badge className="ml-2 text-xs bg-blue-600">Current</Badge>}
              </h4>
              {groupKey !== 'unassigned' && canCreateRun && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createLogisticsRunMutation.mutate({ jobId: groupKey })}
                  disabled={createLogisticsRunMutation.isPending}
                  title="Draft logistics run (V2)"
                >
                  <Truck className="w-3 h-3 mr-1" />
                  Create Run
                </Button>
              )}
              {groupKey === 'unassigned' && (
                <Badge variant="outline" className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No Job — allocate to enable runs
                </Badge>
              )}
            </div>
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
  );
}

// Usage Grouped By Job
function UsageGroupedByJob({ consumptions, jobs, jobId }) {
  const jobIds = Array.from(new Set(consumptions.map(c => c.job_id).filter(Boolean)));
  const groups = ['unassigned', ...jobIds];

  return (
    <div className="space-y-4">
      {groups.map(groupKey => {
        const jobConsumptions = groupKey === 'unassigned'
          ? consumptions.filter(c => !c.job_id)
          : consumptions.filter(c => c.job_id === groupKey);
        
        if (jobConsumptions.length === 0) return null;

        const job = jobs.find(j => j.id === groupKey);
        const isCurrentJob = groupKey === jobId;
        const jobLabel = groupKey === 'unassigned' 
          ? 'Unassigned' 
          : jobId 
            ? 'This Job'
            : job 
              ? `Job #${job.job_number} — ${job.job_type_name || 'Job'}`
              : `Job: ...${groupKey.substring(groupKey.length - 6)}`;

        return (
          <div key={groupKey} className={isCurrentJob ? 'border-2 border-blue-300 rounded-lg p-2' : ''}>
            <h4 className="font-medium mb-2">
              {jobLabel}
              {isCurrentJob && <Badge className="ml-2 text-xs bg-blue-600">Current</Badge>}
            </h4>
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
  );
}

// Requirement Modal
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
            onSubmit(isAdHoc ? { ...formData, catalog_item_id: null } : { ...formData, description: null });
          }}>
            {requirement ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Allocation Modal
function AllocationModal({ open, onClose, projectId, requirements, jobs, priceListItems, allocations, preselectedJobId, onSubmit }) {
  const [formData, setFormData] = useState({
    requirement_line_id: '',
    job_id: '',
    qty_allocated: 1,
    status: 'reserved',
    catalog_item_id: '',
    description: '',
  });
  const [mode, setMode] = useState('requirement');

  useEffect(() => {
    if (open) {
      setFormData({
        requirement_line_id: '',
        job_id: preselectedJobId || '',
        qty_allocated: 1,
        status: 'reserved',
        catalog_item_id: '',
        description: '',
      });
      setMode('requirement');
    }
  }, [open, preselectedJobId]);

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
            <Label>Job {preselectedJobId ? '(This Job)' : '(Required)'}</Label>
            {preselectedJobId ? (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                This Job
              </div>
            ) : (
              <Select value={formData.job_id} onValueChange={(val) => setFormData({ ...formData, job_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      Job #{j.job_number} — {j.job_type_name || 'Job'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
              ? { ...formData, catalog_item_id: null, description: null }
              : { ...formData, requirement_line_id: null }
            );
          }}>
            Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Usage Modal
function UsageModal({ open, onClose, projectId, visitId = null, jobs, allocations, priceListItems, consumptions, preselectedJobId, onSubmit }) {
  const [formData, setFormData] = useState({
    job_id: '',
    catalog_item_id: '',
    description: '',
    qty_consumed: 1,
    source_allocation_id: '',
    notes: '',
  });
  const [mode, setMode] = useState('allocated');

  useEffect(() => {
    if (open) {
      setFormData({
        job_id: preselectedJobId || '',
        catalog_item_id: '',
        description: '',
        qty_consumed: 1,
        source_allocation_id: '',
        notes: '',
      });
      setMode('allocated');
    }
  }, [open, preselectedJobId]);

  // Filter allocations by visit if visitId provided, otherwise by job
  const jobAllocations = visitId
    ? allocations.filter(a => a.visit_id === visitId && a.status !== 'released')
    : formData.job_id 
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
            <Label>Job {preselectedJobId ? '(This Job)' : '(Required)'}</Label>
            {preselectedJobId ? (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                This Job
              </div>
            ) : (
              <Select value={formData.job_id} onValueChange={(val) => setFormData({ ...formData, job_id: val, source_allocation_id: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      Job #{j.job_number} — {j.job_type_name || 'Job'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
              <Label>Source Allocation {visitId && '(This Visit)'}</Label>
              <Select value={formData.source_allocation_id} onValueChange={(val) => setFormData({ ...formData, source_allocation_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose allocation..." />
                </SelectTrigger>
                <SelectContent>
                  {jobAllocations.length === 0 ? (
                    <div className="px-2 py-1 text-sm text-gray-500">No allocations available</div>
                  ) : (
                    jobAllocations.map(a => {
                      const consumed = consumptions
                        .filter(c => c.source_allocation_id === a.id)
                        .reduce((sum, c) => sum + (c.qty_consumed || 0), 0);
                      const remaining = a.qty_allocated - consumed;
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {a.description || a.catalog_item_id} (Available: {remaining}/{a.qty_allocated})
                        </SelectItem>
                      );
                    })
                  )}
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
              ? { ...formData, catalog_item_id: null, description: null }
              : { ...formData, source_allocation_id: null }
            );
          }}>
            Record Usage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}