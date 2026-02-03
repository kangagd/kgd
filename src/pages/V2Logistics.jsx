import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Truck, ArrowUp, ArrowDown, CheckCircle, MapPin, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { isPartsLogisticsV2PilotAllowed } from "../components/utils/allowlist";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";
import { resolveProjectLabel, resolvePurchaseOrderLabel } from "@/components/utils/labelResolvers";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PURPOSE_LABELS = {
  po_pickup_supplier: "PO Pickup (Supplier)",
  po_delivery_loading_bay: "PO Delivery (Loading Bay)",
  loading_bay_to_storage: "Loading Bay → Storage",
  storage_to_vehicle: "Storage → Vehicle",
  vehicle_to_site: "Vehicle → Site",
  sample_pickup: "Sample Pickup",
  sample_dropoff: "Sample Dropoff",
  returns_to_storage: "Returns → Storage",
};

export default function V2Logistics() {
  const [user, setUser] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [createRunModalOpen, setCreateRunModalOpen] = useState(false);
  const [addStopModalOpen, setAddStopModalOpen] = useState(false);
  const [completeStopModalOpen, setCompleteStopModalOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);
  
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

  const isAllowed = user && isPartsLogisticsV2PilotAllowed(user);

  // Fetch runs
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['logisticsRuns'],
    queryFn: async () => {
      const allRuns = await base44.entities.LogisticsRun.list();
      return allRuns.sort((a, b) => {
        const dateA = a.scheduled_start || a.created_date;
        const dateB = b.scheduled_start || b.created_date;
        return new Date(dateB) - new Date(dateA);
      });
    },
    enabled: !!isAllowed,
  });

  // Fetch stops for selected run
  const { data: stops = [] } = useQuery({
    queryKey: ['logisticsStops', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const allStops = await base44.entities.LogisticsStop.filter({ run_id: selectedRunId });
      return allStops.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    },
    enabled: !!selectedRunId && !!isAllowed,
  });

  // Fetch confirmations for selected run
  const { data: confirmations = [] } = useQuery({
    queryKey: ['stopConfirmations', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const stopIds = stops.map(s => s.id);
      if (stopIds.length === 0) return [];
      const allConfirmations = await base44.entities.StopConfirmation.list();
      return allConfirmations.filter(c => stopIds.includes(c.stop_id));
    },
    enabled: !!selectedRunId && Array.isArray(stops) && stops.length > 0 && !!isAllowed,
  });

  // Fetch reference data
  const { data: users = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: !!isAllowed,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: !!isAllowed,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['inventoryLocations'],
    queryFn: () => base44.entities.InventoryLocation.list(),
    enabled: !!isAllowed,
  });

  const selectedRun = runs.find(r => r.id === selectedRunId);

  // Auto-select from query param or first run
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const runIdFromUrl = params.get('runId');
    
    if (runIdFromUrl && runs.find(r => r.id === runIdFromUrl)) {
      setSelectedRunId(runIdFromUrl);
    } else if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <BackButton to={createPageUrl("V2Dashboard")} />
        <Card className="border border-gray-200 mt-4">
          <CardHeader>
            <CardTitle>Logistics (V2) — Not Available</CardTitle>
            <CardDescription>
              This feature is currently in pilot and not available to your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to={createPageUrl("V2Dashboard")} />
          <h1 className="text-2xl font-bold">Logistics (V2) — Pilot</h1>
          <Badge variant="outline">Runs & Stops Coordination</Badge>
        </div>
      </div>

      {runs.length === 0 && !runsLoading && (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-12 text-center">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create your first run</h3>
            <p className="text-gray-600 mb-4">Start planning logistics by creating a new run</p>
            <Button onClick={() => setCreateRunModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Run
            </Button>
          </CardContent>
        </Card>
      )}

      {runs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Runs List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Runs ({runs.length})</CardTitle>
              <Button size="sm" onClick={() => setCreateRunModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {runsLoading ? (
              <p className="text-gray-600 text-center py-8">Loading...</p>
            ) : runs.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No runs yet</p>
            ) : (
              runs.map(run => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedRunId === run.id 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={STATUS_COLORS[run.status] || STATUS_COLORS.draft}>
                      {run.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {run.scheduled_start 
                        ? new Date(run.scheduled_start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                        : 'Unscheduled'
                      }
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {run.assigned_to_name || 'Unassigned'}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {vehicles.find(v => v.id === run.vehicle_id)?.name || 'No vehicle'}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Run Detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {selectedRun ? `Run Details` : 'Select a Run'}
              </CardTitle>
              {selectedRun && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setAddStopModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Stop
                </Button>
                <Badge variant="outline" className="text-xs">
                  Stops: {stops.length} | Completed: {confirmations.length}
                </Badge>
              </div>
              )}
              </div>
              </CardHeader>
              <CardContent>
              {!selectedRun ? (
              <p className="text-gray-600 text-center py-16">Select a run from the list to view details</p>
              ) : (
              <div className="space-y-4">
              {/* Run Info */}
              <RunInfoSection 
                run={selectedRun}
                users={users}
                vehicles={vehicles}
                onUpdate={async (updates) => {
                  await base44.entities.LogisticsRun.update(selectedRun.id, updates);
                  queryClient.invalidateQueries(['logisticsRuns']);
                  toast.success('Run updated');
                }}
              />

              {/* Stops */}
              <div>
                <h3 className="font-semibold mb-3">Stops ({stops.length})</h3>
                  {stops.length === 0 ? (
                    <p className="text-gray-600 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      No stops yet. Click "Add Stop" to create one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stops.map((stop, idx) => {
                        const confirmation = confirmations.find(c => c.stop_id === stop.id);
                        const isCompleted = !!confirmation;
                        
                        return (
                          <StopCard
                            key={stop.id}
                            stop={stop}
                            index={idx}
                            totalStops={stops.length}
                            isCompleted={isCompleted}
                            confirmation={confirmation}
                            locations={locations}
                            onMoveUp={async () => {
                              if (idx === 0) return;
                              const prevStop = stops[idx - 1];
                              await base44.entities.LogisticsStop.update(stop.id, { sequence: stop.sequence - 1 });
                              await base44.entities.LogisticsStop.update(prevStop.id, { sequence: prevStop.sequence + 1 });
                              queryClient.invalidateQueries(['logisticsStops', selectedRunId]);
                            }}
                            onMoveDown={async () => {
                              if (idx === stops.length - 1) return;
                              const nextStop = stops[idx + 1];
                              await base44.entities.LogisticsStop.update(stop.id, { sequence: stop.sequence + 1 });
                              await base44.entities.LogisticsStop.update(nextStop.id, { sequence: nextStop.sequence - 1 });
                              queryClient.invalidateQueries(['logisticsStops', selectedRunId]);
                            }}
                            onComplete={() => {
                              setSelectedStop(stop);
                              setCompleteStopModalOpen(true);
                            }}
                            onDelete={async () => {
                              if (confirm('Delete this stop?')) {
                                await base44.entities.LogisticsStop.delete(stop.id);
                                // Re-sequence remaining stops to 1..N
                                const remainingStops = stops.filter(s => s.id !== stop.id);
                                for (let i = 0; i < remainingStops.length; i++) {
                                  if (remainingStops[i].sequence !== i + 1) {
                                    await base44.entities.LogisticsStop.update(remainingStops[i].id, { sequence: i + 1 });
                                  }
                                }
                                queryClient.invalidateQueries(['logisticsStops', selectedRunId]);
                                toast.success('Stop deleted');
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Modals */}
      <CreateRunModal
        open={createRunModalOpen}
        onClose={() => setCreateRunModalOpen(false)}
        users={users}
        vehicles={vehicles}
        onSubmit={async (data) => {
          const newRun = await base44.entities.LogisticsRun.create({
            ...data,
            status: 'draft',
          });
          queryClient.invalidateQueries(['logisticsRuns']);
          setSelectedRunId(newRun.id);
          setCreateRunModalOpen(false);
          toast.success('Run created');
        }}
      />

      <AddStopModal
        open={addStopModalOpen}
        onClose={() => setAddStopModalOpen(false)}
        runId={selectedRunId}
        currentStopCount={stops.length}
        locations={locations}
        onSubmit={async (data) => {
          await base44.entities.LogisticsStop.create({
            ...data,
            run_id: selectedRunId,
            sequence: stops.length + 1,
          });
          queryClient.invalidateQueries(['logisticsStops', selectedRunId]);
          setAddStopModalOpen(false);
          toast.success('Stop added');
        }}
      />

      <CompleteStopModal
        open={completeStopModalOpen}
        onClose={() => {
          setCompleteStopModalOpen(false);
          setSelectedStop(null);
        }}
        stop={selectedStop}
        user={user}
        onSubmit={async (data) => {
          const confirmation = await base44.entities.StopConfirmation.create({
            stop_id: selectedStop.id,
            completed_by_user_id: user.id,
            completed_by_name: user.full_name || user.email,
            completed_at: new Date().toISOString(),
            notes: data.notes || '',
            photos_json: JSON.stringify(data.photos || []),
          });
          
          // Auto-create receipt for loading bay delivery stops
          try {
            const receiptResult = await base44.functions.invoke('ensureReceiptForStopConfirmation', {
              stop_confirmation_id: confirmation.id
            });

            const data = receiptResult?.data;

            if (!data?.success) {
              console.error('Receipt creation failed (non-blocking):', data);
              toast.warning(`Stop completed, but receipt creation failed: ${data?.reason || data?.error || 'unknown'}`);
            } else if (data?.skipped) {
              console.log('Receipt creation skipped:', data.reason, data.stop_purpose);
            } else {
              console.log('Receipt auto-created:', data.receipt_id, data.existed ? '(existed)' : '(created)');
            }
          } catch (error) {
            console.error('Receipt creation failed (invoke threw):', error);
            toast.warning('Stop completed, but receipt creation failed (check console).');
          }

          // Auto-clear receipt for clear_loading_bay stops
          try {
            const clearResult = await base44.functions.invoke('markReceiptClearedFromStopConfirmation', {
              stop_confirmation_id: confirmation.id
            });

            const clearData = clearResult?.data;

            if (!clearData?.success) {
              console.error('Receipt clearing failed (non-blocking):', clearData);
              toast.warning('Stop completed, but receipt clearing failed (check console)');
            } else if (clearData?.skipped) {
              console.log('Receipt clearing skipped:', clearData.reason);
            } else if (clearData?.existed) {
              console.log('Receipt already cleared:', clearData.receipt_id);
            } else if (clearData?.updated) {
              console.log('Receipt marked as cleared:', clearData.receipt_id);
            }
          } catch (error) {
            console.error('Receipt clearing failed (invoke threw):', error);
          }

          // Apply inventory movements for clear_loading_bay stops
          try {
            const movementResult = await base44.functions.invoke('applyInventoryMovementsForClearStop', {
              stop_confirmation_id: confirmation.id
            });

            const movementData = movementResult?.data;

            if (!movementData?.success) {
              console.error('Inventory movements failed (non-blocking):', movementData);
              if (movementData?.reason === 'missing_to_location') {
                toast.warning('Stop completed, inventory not moved: missing destination location.');
              }
            } else if (movementData?.skipped) {
              console.log('Inventory movements skipped:', movementData.reason);
            } else {
              console.log(`Inventory movements: created ${movementData.created}, skipped ${movementData.skipped}`);
            }
          } catch (error) {
            console.error('Inventory movements failed (invoke threw):', error);
          }

          // Update run status + propagate to linked records
          try {
            const runUpdateResult = await base44.functions.invoke('completeStopAndUpdateRun', {
              stop_confirmation_id: confirmation.id
            });

            const runData = runUpdateResult?.data;
            if (runData?.success && runData?.status_changed) {
              console.log(`[V2Logistics] Run status updated to ${runData.run_status} (${runData.completed_count}/${runData.total_stops} stops completed)`);
            }
          } catch (error) {
            console.error('Run status update failed (non-blocking):', error);
          }
          
          queryClient.invalidateQueries(['stopConfirmations', selectedRunId]);
          queryClient.invalidateQueries(['logisticsRuns']);
          queryClient.invalidateQueries(['receipts', 'loading-bay']); // Refresh Loading Bay
          queryClient.invalidateQueries(['stockAllocations']); // Refresh allocations
          setCompleteStopModalOpen(false);
          setSelectedStop(null);
          toast.success('Stop completed');
        }}
      />
    </div>
  );
}

// Run Info Section
function RunInfoSection({ run, users, vehicles, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    status: run.status || 'draft',
    assigned_to_user_id: run.assigned_to_user_id || '',
    vehicle_id: run.vehicle_id || '',
    scheduled_start: run.scheduled_start ? run.scheduled_start.substring(0, 16) : '',
    scheduled_end: run.scheduled_end ? run.scheduled_end.substring(0, 16) : '',
    notes: run.notes || '',
  });

  useEffect(() => {
    setFormData({
      status: run.status || 'draft',
      assigned_to_user_id: run.assigned_to_user_id || '',
      vehicle_id: run.vehicle_id || '',
      scheduled_start: run.scheduled_start ? run.scheduled_start.substring(0, 16) : '',
      scheduled_end: run.scheduled_end ? run.scheduled_end.substring(0, 16) : '',
      notes: run.notes || '',
    });
  }, [run]);

  if (!editing) {
    const assignedUser = users.find(u => u.id === run.assigned_to_user_id);
    const vehicle = vehicles.find(v => v.id === run.vehicle_id);
    
    return (
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <Badge className={STATUS_COLORS[run.status]}>{run.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Assigned:</span>
              <span className="text-sm">{assignedUser?.full_name || assignedUser?.email || 'Unassigned'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Vehicle:</span>
              <span className="text-sm">{vehicle?.name || 'No vehicle'}</span>
            </div>
            {run.scheduled_start && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Scheduled:</span>
                <span className="text-sm">
                  {new Date(run.scheduled_start).toLocaleString('en-AU')}
                  {run.scheduled_end && ` - ${new Date(run.scheduled_end).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              </div>
            )}
            {run.notes && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-600">Notes:</span>
                <span className="text-sm text-gray-700">{run.notes}</span>
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Assigned To</Label>
          <Select value={formData.assigned_to_user_id} onValueChange={(val) => {
            const user = users.find(u => u.id === val);
            setFormData({ 
              ...formData, 
              assigned_to_user_id: val,
            });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select technician..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Vehicle</Label>
          <Select value={formData.vehicle_id} onValueChange={(val) => setFormData({ ...formData, vehicle_id: val })}>
            <SelectTrigger>
              <SelectValue placeholder="Select vehicle..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Scheduled Start</Label>
          <Input
            type="datetime-local"
            value={formData.scheduled_start}
            onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
          />
        </div>

        <div className="col-span-2">
          <Label>Scheduled End</Label>
          <Input
            type="datetime-local"
            value={formData.scheduled_end}
            onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Run notes..."
          rows={2}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" onClick={() => {
          const assignedUser = users.find(u => u.id === formData.assigned_to_user_id);
          onUpdate({
            ...formData,
            assigned_to_name: assignedUser?.full_name || assignedUser?.email || null,
            scheduled_start: formData.scheduled_start || null,
            scheduled_end: formData.scheduled_end || null,
          });
          setEditing(false);
        }}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Stop Card Component
function StopCard({ stop, index, totalStops, isCompleted, confirmation, locations, onMoveUp, onMoveDown, onComplete, onDelete }) {
  const location = locations.find(l => l.id === stop.location_id);
  
  return (
    <div className={`border rounded-lg p-3 ${isCompleted ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs font-mono">#{stop.sequence}</Badge>
            <span className="font-medium text-sm">{PURPOSE_LABELS[stop.purpose] || stop.purpose}</span>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
          </div>
          
          {location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              <MapPin className="w-3.5 h-3.5" />
              {location.name}
            </div>
          )}
          
          {stop.project_id && (
            <div className="text-xs text-gray-600 mb-1">Project: {stop.project_id}</div>
          )}
          
          {stop.purchase_order_id && (
            <div className="text-xs text-gray-600 mb-1">PO: {stop.purchase_order_id}</div>
          )}
          
          {stop.instructions && (
            <div className="text-xs text-gray-500 mt-2 italic">{stop.instructions}</div>
          )}

          {isCompleted && confirmation && (
            <div className="mt-2 pt-2 border-t border-green-200">
              <div className="text-xs text-green-700">
                Completed by {confirmation.completed_by_name} on {new Date(confirmation.completed_at).toLocaleString('en-AU')}
              </div>
              {confirmation.notes && (
                <div className="text-xs text-gray-600 mt-1">{confirmation.notes}</div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {!isCompleted && (
            <>
              <Button size="sm" variant="ghost" onClick={onMoveUp} disabled={index === 0} title="Move up">
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onMoveDown} disabled={index === totalStops - 1} title="Move down">
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={onComplete} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Run Modal
function CreateRunModal({ open, onClose, users, vehicles, onSubmit }) {
  const [formData, setFormData] = useState({
    assigned_to_user_id: '',
    vehicle_id: '',
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        assigned_to_user_id: '',
        vehicle_id: '',
        scheduled_start: '',
        scheduled_end: '',
        notes: '',
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Logistics Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Assigned To</Label>
            <Select value={formData.assigned_to_user_id} onValueChange={(val) => {
              const user = users.find(u => u.id === val);
              setFormData({ 
                ...formData, 
                assigned_to_user_id: val,
              });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Vehicle (optional)</Label>
            <Select value={formData.vehicle_id} onValueChange={(val) => setFormData({ ...formData, vehicle_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Scheduled Start</Label>
            <Input
              type="datetime-local"
              value={formData.scheduled_start}
              onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
            />
          </div>

          <div>
            <Label>Scheduled End</Label>
            <Input
              type="datetime-local"
              value={formData.scheduled_end}
              onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Run notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            const assignedUser = users.find(u => u.id === formData.assigned_to_user_id);
            onSubmit({
              ...formData,
              assigned_to_name: assignedUser?.full_name || assignedUser?.email || null,
              scheduled_start: formData.scheduled_start || null,
              scheduled_end: formData.scheduled_end || null,
            });
          }}>
            Create Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Stop Modal
function AddStopModal({ open, onClose, runId, currentStopCount, locations, onSubmit }) {
  const [formData, setFormData] = useState({
    purpose: '',
    location_id: '',
    project_id: '',
    purchase_order_id: '',
    requires_photos: false,
    requires_qty_confirm: false,
    instructions: '',
  });

  const [projects, setProjects] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  useEffect(() => {
    if (open) {
      // Load projects and POs
      base44.entities.Project.list('-updated_date', 200).then(setProjects).catch(() => setProjects([]));
      base44.entities.PurchaseOrder.list().then(setPurchaseOrders).catch(() => setPurchaseOrders([]));
      
      setFormData({
        purpose: '',
        location_id: '',
        project_id: '',
        purchase_order_id: '',
        requires_photos: false,
        requires_qty_confirm: false,
        instructions: '',
      });
    }
  }, [open]);

  // Auto-set requires_photos based on purpose
  useEffect(() => {
    if (formData.purpose === 'po_pickup_supplier' || formData.purpose === 'po_delivery_loading_bay') {
      setFormData(prev => ({ ...prev, requires_photos: true }));
    }
  }, [formData.purpose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Stop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Purpose *</Label>
            <Select value={formData.purpose} onValueChange={(val) => setFormData({ ...formData, purpose: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select purpose..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="po_pickup_supplier">PO Pickup (Supplier)</SelectItem>
                <SelectItem value="po_delivery_loading_bay">PO Delivery (Loading Bay)</SelectItem>
                <SelectItem value="loading_bay_to_storage">Loading Bay → Storage</SelectItem>
                <SelectItem value="storage_to_vehicle">Storage → Vehicle</SelectItem>
                <SelectItem value="vehicle_to_site">Vehicle → Site</SelectItem>
                <SelectItem value="sample_pickup">Sample Pickup</SelectItem>
                <SelectItem value="sample_dropoff">Sample Dropoff</SelectItem>
                <SelectItem value="returns_to_storage">Returns → Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Location (optional)</Label>
            <Select value={formData.location_id} onValueChange={(val) => setFormData({ ...formData, location_id: val })}>
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
            <Label>Project (optional)</Label>
            <Select value={formData.project_id} onValueChange={(val) => setFormData({ ...formData, project_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.project_number} - {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Purchase Order (optional)</Label>
            <Select value={formData.purchase_order_id} onValueChange={(val) => setFormData({ ...formData, purchase_order_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select PO..." />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders.map(po => (
                  <SelectItem key={po.id} value={po.id}>
                    PO #{po.id.substring(0, 8)} - {po.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_photos}
                onChange={(e) => setFormData({ ...formData, requires_photos: e.target.checked })}
              />
              <span className="text-sm">Requires Photos</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_qty_confirm}
                onChange={(e) => setFormData({ ...formData, requires_qty_confirm: e.target.checked })}
              />
              <span className="text-sm">Requires Qty Confirm</span>
            </label>
          </div>

          <div>
            <Label>Instructions</Label>
            <Textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Stop instructions..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!formData.purpose) {
              toast.error('Please select a purpose');
              return;
            }
            onSubmit({
              ...formData,
              location_id: formData.location_id || null,
              project_id: formData.project_id || null,
              purchase_order_id: formData.purchase_order_id || null,
            });
          }}>
            Add Stop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Complete Stop Modal
function CompleteStopModal({ open, onClose, stop, user, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes('');
      setPhotos([]);
    }
  }, [open]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setPhotos(prev => [...prev, ...urls]);
      toast.success(`${urls.length} photo(s) uploaded`);
    } catch (error) {
      toast.error('Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!stop) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Stop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium mb-1">{PURPOSE_LABELS[stop.purpose] || stop.purpose}</div>
            {stop.instructions && (
              <div className="text-xs text-gray-600">{stop.instructions}</div>
            )}
          </div>

          {stop.requires_photos && (
            <div>
              <Label>Photos {stop.requires_photos && <span className="text-red-600">*</span>}</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {photos.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {photos.length} photo(s) uploaded
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Completion notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => {
              if (stop.requires_photos && photos.length === 0) {
                toast.error('Photos are required for this stop');
                return;
              }
              onSubmit({ notes, photos });
            }}
            disabled={uploading}
          >
            Complete Stop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}