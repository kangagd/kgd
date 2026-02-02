import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PartsV2Panel({ projectId, visitId = null }) {
  const [activeTab, setActiveTab] = useState("requirements");
  const [user, setUser] = useState(null);
  
  // Modal states
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideData, setOverrideData] = useState(null);
  const [quickActionVisitId, setQuickActionVisitId] = useState(visitId);

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
    if (visitId) {
      setQuickActionVisitId(visitId);
    }
  }, [visitId]);

  // Fetch visits for selected project
  const { data: visits = [] } = useQuery({
    queryKey: ['visits', projectId],
    queryFn: async () => {
      return await base44.entities.Visit.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  // Fetch requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ['projectRequirementLines', projectId],
    queryFn: async () => {
      return await base44.entities.ProjectRequirementLine.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  // Fetch allocations
  const { data: allocations = [] } = useQuery({
    queryKey: ['stockAllocations', projectId],
    queryFn: async () => {
      return await base44.entities.StockAllocation.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  // Fetch usage
  const { data: consumptions = [] } = useQuery({
    queryKey: ['stockConsumptions', projectId],
    queryFn: async () => {
      return await base44.entities.StockConsumption.filter({ project_id: projectId });
    },
    enabled: !!projectId,
  });

  // Fetch price list items for catalog search
  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list(),
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
    mutationFn: async ({ visit }) => {
      // Create the run
      const run = await base44.entities.LogisticsRun.create({
        assigned_to_user_id: visit.assigned_to_user_id || null,
        assigned_to_name: visit.assigned_to_name || null,
        vehicle_id: visit.vehicle_id || null,
        scheduled_start: visit.start_time || null,
        status: "draft",
        notes: `Auto-created from Parts V2 allocations for Visit ${visit.visit_number || visit.id}`,
      });

      // Create stops
      const stops = [
        {
          run_id: run.id,
          sequence: 1,
          purpose: "storage_to_vehicle",
          project_id: projectId,
          requires_photos: false,
          instructions: "Load parts from storage to vehicle",
        },
        {
          run_id: run.id,
          sequence: 2,
          purpose: "vehicle_to_site",
          project_id: projectId,
          requires_photos: false,
          instructions: "Deliver parts to site",
        },
      ];

      await Promise.all(stops.map(stop => base44.entities.LogisticsStop.create(stop)));

      return run;
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries(['logisticsRuns']);
      toast.success('Draft run created. Open in Logistics (V2).', {
        action: {
          label: 'View Run',
          onClick: () => navigate(createPageUrl("V2Logistics") + `?runId=${run.id}`),
        },
      });
    },
    onError: () => {
      toast.error('Failed to create logistics run');
    },
  });

  // Filter allocations/consumptions by visit if visitId is provided
  const filteredAllocations = visitId 
    ? allocations.filter(a => a.visit_id === visitId)
    : allocations;

  const filteredConsumptions = visitId 
    ? consumptions.filter(c => c.visit_id === visitId)
    : consumptions;

  return (
    <div className="space-y-4">
      {/* Quick Actions for Visit Context */}
      {visitId && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-900">Quick Actions for This Visit</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" onClick={() => { setQuickActionVisitId(visitId); setAllocationModalOpen(true); }}>
              Allocate to This Visit
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setQuickActionVisitId(visitId); setUsageModalOpen(true); }}>
              Add Usage for This Visit
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
                <CardTitle>Allocations {visitId && '(Filtered to This Visit)'}</CardTitle>
                <Button onClick={() => { setQuickActionVisitId(visitId); setAllocationModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Allocation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAllocations.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No allocations yet</p>
              ) : (
                <div className="space-y-4">
                  {['unassigned', ...visits.map(v => v.id)].map(vid => {
                    const visitAllocations = filteredAllocations.filter(a => 
                      vid === 'unassigned' ? !a.visit_id : a.visit_id === vid
                    );
                    if (visitAllocations.length === 0) return null;
                    
                    const visit = visits.find(v => v.id === vid);
                    const isCurrentVisit = vid === visitId;
                    
                    return (
                      <div key={vid} className={isCurrentVisit ? 'border-2 border-blue-300 rounded-lg p-2' : ''}>
                        <h4 className="font-medium mb-2">
                          {vid === 'unassigned' ? 'Unassigned' : `Visit: ${visit?.visit_number || vid}`}
                          {isCurrentVisit && <Badge className="ml-2 text-xs bg-blue-600">Current</Badge>}
                        </h4>
                        <div className="space-y-2">
                          {visitAllocations.map(alloc => (
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
                <CardTitle>Usage {visitId && '(Filtered to This Visit)'}</CardTitle>
                <Button onClick={() => { setQuickActionVisitId(visitId); setUsageModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Usage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredConsumptions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No usage recorded yet</p>
              ) : (
                <div className="space-y-4">
                  {['unassigned', ...visits.map(v => v.id)].map(vid => {
                    const visitConsumptions = filteredConsumptions.filter(c => 
                      vid === 'unassigned' ? !c.visit_id : c.visit_id === vid
                    );
                    if (visitConsumptions.length === 0) return null;
                    
                    const visit = visits.find(v => v.id === vid);
                    const isCurrentVisit = vid === visitId;
                    
                    return (
                      <div key={vid} className={isCurrentVisit ? 'border-2 border-blue-300 rounded-lg p-2' : ''}>
                        <h4 className="font-medium mb-2">
                          {vid === 'unassigned' ? 'Unassigned' : `Visit: ${visit?.visit_number || vid}`}
                          {isCurrentVisit && <Badge className="ml-2 text-xs bg-blue-600">Current</Badge>}
                        </h4>
                        <div className="space-y-2">
                          {visitConsumptions.map(cons => (
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
        visits={visits}
        priceListItems={priceListItems}
        allocations={allocations}
        preselectedVisitId={quickActionVisitId}
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
        visits={visits}
        allocations={allocations}
        priceListItems={priceListItems}
        consumptions={consumptions}
        preselectedVisitId={quickActionVisitId}
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
            project_id: projectId,
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

// Sub-components (same as V2Parts.jsx)
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

function AllocationModal({ open, onClose, projectId, requirements, visits, priceListItems, allocations, preselectedVisitId, onSubmit }) {
  const [formData, setFormData] = useState({
    requirement_line_id: '',
    visit_id: '',
    qty_allocated: 1,
    status: 'reserved',
    vehicle_id: '',
    catalog_item_id: '',
    description: '',
  });
  const [mode, setMode] = useState('requirement');

  useEffect(() => {
    if (open) {
      setFormData({
        requirement_line_id: '',
        visit_id: preselectedVisitId || '',
        qty_allocated: 1,
        status: 'reserved',
        vehicle_id: '',
        catalog_item_id: '',
        description: '',
      });
      setMode('requirement');
    }
  }, [open, preselectedVisitId]);

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
            <Label>Visit (Required if available)</Label>
            <Select value={formData.visit_id} onValueChange={(val) => setFormData({ ...formData, visit_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose visit..." />
              </SelectTrigger>
              <SelectContent>
                {visits.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    Visit #{v.visit_number || v.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            if (visits.length > 0 && !formData.visit_id) {
              toast.error('Please select a visit');
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

function UsageModal({ open, onClose, projectId, visits, allocations, priceListItems, consumptions, preselectedVisitId, onSubmit }) {
  const [formData, setFormData] = useState({
    visit_id: '',
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
        visit_id: preselectedVisitId || '',
        catalog_item_id: '',
        description: '',
        qty_consumed: 1,
        source_allocation_id: '',
        notes: '',
      });
      setMode('allocated');
    }
  }, [open, preselectedVisitId]);

  const visitAllocations = formData.visit_id 
    ? allocations.filter(a => a.visit_id === formData.visit_id && a.status !== 'released')
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Usage</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Visit</Label>
            <Select value={formData.visit_id} onValueChange={(val) => setFormData({ ...formData, visit_id: val, source_allocation_id: '' })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose visit..." />
              </SelectTrigger>
              <SelectContent>
                {visits.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    Visit #{v.visit_number || v.id}
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
                  {visitAllocations.map(a => (
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
            if (!formData.visit_id) {
              toast.error('Please select a visit');
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