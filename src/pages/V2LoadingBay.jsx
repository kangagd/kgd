import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isPartsLogisticsV2PilotAllowed } from '@/components/utils/allowlist';
import { Package, Clock, AlertTriangle, CheckCircle, Camera, ExternalLink, Loader2, RefreshCw, Truck, Database } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function V2LoadingBay() {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [showCreateRunModal, setShowCreateRunModal] = useState(false);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [isEnsuringLocations, setIsEnsuringLocations] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setAllowed(isPartsLogisticsV2PilotAllowed(currentUser));
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
        setAllowed(false);
      }
    };
    loadUser();
  }, []);

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['loadingBayReceipts'],
    queryFn: async () => {
      const results = await base44.entities.Receipt.filter({ status: 'open' });
      return results.sort((a, b) => {
        const aTime = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
        const bTime = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
        return aTime - bTime;
      });
    },
    enabled: allowed,
    staleTime: 30000,
    refetchOnWindowFocus: true, // Auto-refresh when returning to page
  });

  // Fetch related projects
  const projectIds = [...new Set(receipts.map(r => r.project_id).filter(Boolean))].slice(0, 25);
  const { data: projects = [] } = useQuery({
    queryKey: ['loadingBayProjects', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const results = await Promise.all(
        projectIds.map(id => base44.entities.Project.get(id).catch(() => null))
      );
      return results.filter(Boolean);
    },
    enabled: allowed && projectIds.length > 0,
  });

  // Fetch related POs
  const poIds = [...new Set(receipts.map(r => r.purchase_order_id).filter(Boolean))].slice(0, 25);
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['loadingBayPOs', poIds],
    queryFn: async () => {
      if (poIds.length === 0) return [];
      const results = await Promise.all(
        poIds.map(id => base44.entities.PurchaseOrder.get(id).catch(() => null))
      );
      return results.filter(Boolean);
    },
    enabled: allowed && poIds.length > 0,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Not Available</CardTitle>
            <CardDescription>
              This feature is only available to authorized users in the V2 pilot program.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // SLA computation helper
  const computeSLA = (receipt) => {
    const now = new Date();
    
    // Use sla_clock_start_at as the primary clock source, fallback to received_at
    const startAt = receipt.sla_clock_start_at 
      ? new Date(receipt.sla_clock_start_at) 
      : (receipt.received_at ? new Date(receipt.received_at) : null);
    
    const dueAt = receipt.sla_due_at 
      ? new Date(receipt.sla_due_at) 
      : (startAt ? new Date(startAt.getTime() + 48 * 3600 * 1000) : null);

    // Validate parsed dates
    if (!startAt || !dueAt || isNaN(startAt.getTime()) || isNaN(dueAt.getTime())) {
      return { status: 'Unknown', ageHours: 0, dueInHours: 0 };
    }

    const ageHours = Math.floor((now.getTime() - startAt.getTime()) / 3600000);
    const dueInHours = Math.floor((dueAt.getTime() - now.getTime()) / 3600000);

    let status = 'OK';
    if (now.getTime() > dueAt.getTime()) {
      status = 'Breached';
    } else if (dueInHours <= 24) {
      status = 'Due Soon';
    }

    return { status, ageHours, dueInHours };
  };

  // Helper: determine if receipt is cleared
  const isReceiptCleared = (receipt) => {
    return receipt.status === 'cleared' || 
           !!receipt.cleared_at || 
           (!!receipt.clear_run_id && !!receipt.moved_out_at);
  };

  // Filter out cleared receipts for display and counts
  const displayReceipts = receipts; // Show all for transparency
  const openReceipts = receipts.filter(r => !isReceiptCleared(r));

  // Compute summary stats (only for open/non-cleared receipts)
  const openCount = openReceipts.length;
  const dueSoon = openReceipts.filter(r => {
    const sla = computeSLA(r);
    return sla.status === 'Due Soon';
  }).length;
  const breached = openReceipts.filter(r => {
    const sla = computeSLA(r);
    return sla.status === 'Breached';
  }).length;

  // Helper to get project info
  const getProjectInfo = (projectId) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    if (project) {
      return {
        number: project.project_number,
        title: project.title,
      };
    }
    return null;
  };

  // Helper to get PO info
  const getPOInfo = (poId) => {
    if (!poId) return null;
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      return {
        reference: po.reference_number || po.supplier_po_number || 'PO',
      };
    }
    return null;
  };

  // Helper to get photo count
  const getPhotoCount = (photosJson) => {
    if (!photosJson) return 0;
    try {
      const photos = JSON.parse(photosJson);
      return Array.isArray(photos) ? photos.length : 0;
    } catch {
      return 0;
    }
  };

  // Handle normalize SLA
  const handleNormalizeSLA = async () => {
    setIsNormalizing(true);
    try {
      const result = await base44.functions.invoke('normalizeReceiptSlaFromReceivedAt', {});
      
      if (result.data?.success) {
        const { checked, updated, skipped, failed } = result.data;
        toast.success(`Normalized ${updated} receipts (${checked} checked, ${skipped} skipped, ${failed} failed)`);
        
        // Refresh receipts
        window.location.reload();
      } else {
        toast.error(`Normalization failed: ${result.data?.error || 'unknown error'}`);
      }
    } catch (error) {
      console.error('Normalize SLA error:', error);
      toast.error('Normalization failed (check console)');
    } finally {
      setIsNormalizing(false);
    }
  };

  // Handle create clear run
  const handleCreateClearRun = async (formData) => {
    setIsCreatingRun(true);
    try {
      const result = await base44.functions.invoke('createClearRunFromReceipts', {
        receipt_ids: selectedReceipts,
        assigned_to_user_id: formData.assigned_to_user_id,
        assigned_to_name: formData.assigned_to_name,
        vehicle_id: formData.vehicle_id,
        target_location_id: formData.target_location_id
      });

      if (result.data?.success) {
        const { run_id, created_stops, skipped_receipts } = result.data;
        
        if (run_id) {
          toast.success(`Created clear run with ${created_stops} stops`);
          setShowCreateRunModal(false);
          setSelectedReceipts([]);
          
          // Navigate to run
          window.location.href = `${createPageUrl('V2Logistics')}?runId=${run_id}`;
        } else {
          toast.warning(`No run created: ${result.data.message}`);
          setShowCreateRunModal(false);
        }
      } else {
        toast.error(`Failed to create run: ${result.data?.error || 'unknown error'}`);
      }
    } catch (error) {
      console.error('Create clear run error:', error);
      toast.error('Failed to create run (check console)');
    } finally {
      setIsCreatingRun(false);
    }
  };

  // Toggle receipt selection
  const toggleReceipt = (receiptId) => {
    setSelectedReceipts(prev => 
      prev.includes(receiptId) 
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId]
    );
  };

  // Toggle all receipts (exclude cleared receipts)
  const toggleAllReceipts = () => {
    const eligibleReceipts = receipts.filter(r => !r.clear_run_id && !isReceiptCleared(r));
    if (selectedReceipts.length === eligibleReceipts.length && eligibleReceipts.length > 0) {
      setSelectedReceipts([]);
    } else {
      setSelectedReceipts(eligibleReceipts.map(r => r.id));
    }
  };

  // Handle ensure locations
  const handleEnsureLocations = async () => {
    setIsEnsuringLocations(true);
    try {
      const result = await base44.functions.invoke('ensureInventoryLocationsV2', {});
      
      if (result.data?.success) {
        const { created, updated, skipped, vehicle_locations_created, vehicle_locations_updated } = result.data;
        toast.success(`Locations ensured: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped. Vehicles: ${vehicle_locations_created} created, ${vehicle_locations_updated} linked.`);
      } else {
        toast.error(`Failed: ${result.data?.error || 'unknown error'}`);
      }
    } catch (error) {
      console.error('Ensure locations error:', error);
      toast.error('Failed to ensure locations (check console)');
    } finally {
      setIsEnsuringLocations(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-h1 mb-2">Loading Bay (V2)</h1>
          <p className="text-secondary text-sm">Open receipts awaiting move (48h SLA)</p>
        </div>
        <div className="flex gap-2">
          {selectedReceipts.length > 0 && (
            <Button
              onClick={() => setShowCreateRunModal(true)}
              className="flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Create Clear Run ({selectedReceipts.length})
            </Button>
          )}
          <Button
            onClick={handleNormalizeSLA}
            disabled={isNormalizing}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isNormalizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Normalize SLA
          </Button>
          {user?.role === 'admin' && (
            <Button
              onClick={handleEnsureLocations}
              disabled={isEnsuringLocations}
              variant="outline"
              className="flex items-center gap-2"
              title="Ensure canonical inventory locations (WAREHOUSE_MAIN, LOADING_BAY, CONSUMED) and vehicle locations"
            >
              {isEnsuringLocations ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Ensure Locations (V2)
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted">Open Receipts</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted">Due Soon (24h)</p>
                <p className="text-2xl font-bold">{dueSoon}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted">Breached</p>
                <p className="text-2xl font-bold">{breached}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {receiptsLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B7280] mx-auto mb-3" />
            <p className="text-muted">Loading receipts...</p>
          </CardContent>
        </Card>
      )}

      {!receiptsLoading && receipts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No items in Loading Bay 🎉</h3>
            <p className="text-muted">All receipts have been processed.</p>
          </CardContent>
        </Card>
      )}

      {/* Receipts Table */}
      {!receiptsLoading && receipts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-4 py-3">
                      <Checkbox
                        checked={selectedReceipts.length === receipts.filter(r => !r.clear_run_id && !isReceiptCleared(r)).length && receipts.filter(r => !r.clear_run_id && !isReceiptCleared(r)).length > 0}
                        onCheckedChange={toggleAllReceipts}
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Received</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Age</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">SLA</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">PO</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Photos</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReceipts.map((receipt) => {
                    const sla = computeSLA(receipt);
                    const projectInfo = getProjectInfo(receipt.project_id);
                    const poInfo = getPOInfo(receipt.purchase_order_id);
                    const photoCount = getPhotoCount(receipt.photos_json);
                    const isCleared = isReceiptCleared(receipt);
                    const isRunCreated = !!receipt.clear_run_id && !isCleared;

                    return (
                      <tr key={receipt.id} className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB] ${isCleared ? 'opacity-75 bg-green-50' : ''}`}>
                        <td className="px-4 py-3">
                          {isCleared ? (
                            <div className="w-4 h-4 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                          ) : isRunCreated ? (
                            <div className="text-xs text-muted" title="Run already created">
                              <Checkbox checked={false} disabled />
                            </div>
                          ) : (
                            <Checkbox
                              checked={selectedReceipts.includes(receipt.id)}
                              onCheckedChange={() => toggleReceipt(receipt.id)}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {receipt.received_at ? format(new Date(receipt.received_at), 'MMM d, HH:mm') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sla.ageHours > 0 ? `${sla.ageHours}h` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {sla.status === 'Breached' && (
                            <Badge variant="error" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Breached
                            </Badge>
                          )}
                          {sla.status === 'Due Soon' && (
                            <Badge variant="warning" className="flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3" />
                              Due Soon
                            </Badge>
                          )}
                          {sla.status === 'OK' && (
                            <Badge variant="success" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              OK
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {projectInfo ? (
                            <Link
                              to={`${createPageUrl('Projects')}?projectId=${receipt.project_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              #{projectInfo.number} {projectInfo.title}
                            </Link>
                          ) : receipt.project_id ? (
                            <span className="text-muted">Project</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {poInfo ? (
                            <span className="text-[#111827]">{poInfo.reference}</span>
                          ) : receipt.purchase_order_id ? (
                            <span className="text-muted">PO</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {receipt.location_id ? (
                            <span className="text-[#111827]">Loading Bay</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {photoCount > 0 ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <Camera className="w-3 h-3" />
                              {photoCount}
                            </Badge>
                          ) : (
                            <span className="text-muted text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isCleared ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                Cleared ✅
                              </Badge>
                              {receipt.clear_run_id && (
                                <Link
                                  to={`${createPageUrl('V2Logistics')}?runId=${receipt.clear_run_id}`}
                                  className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                >
                                  View Run
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          ) : isRunCreated ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                                Run Created
                              </Badge>
                              <Link
                                to={`${createPageUrl('V2Logistics')}?runId=${receipt.clear_run_id}`}
                                className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                              >
                                View Run
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedReceipts([receipt.id]);
                                setShowCreateRunModal(true);
                              }}
                              className="text-xs"
                            >
                              Create Run
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Run Modal */}
      <CreateRunModal
        open={showCreateRunModal}
        onClose={() => {
          setShowCreateRunModal(false);
          setSelectedReceipts([]);
        }}
        onSubmit={handleCreateClearRun}
        isLoading={isCreatingRun}
        receiptCount={selectedReceipts.length}
      />
    </div>
  );
}

function CreateRunModal({ open, onClose, onSubmit, isLoading, receiptCount }) {
  const [formData, setFormData] = useState({
    assigned_to_user_id: '',
    assigned_to_name: '',
    vehicle_id: '',
    target_location_id: ''
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-run'],
    queryFn: async () => {
      const allUsers = await base44.entities.User.filter({ deleted_at: { $exists: false } });
      // Filter to technicians if extended_role exists, otherwise include all
      return allUsers.filter(u => !u.extended_role || u.extended_role === 'technician' || u.is_field_technician === true);
    },
    enabled: open
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-for-run'],
    queryFn: async () => {
      return await base44.entities.Vehicle.filter({ deleted_at: { $exists: false } });
    },
    enabled: open
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleTechnicianChange = (userId) => {
    if (!userId) {
      setFormData({ ...formData, assigned_to_user_id: '', assigned_to_name: '' });
      return;
    }
    const user = users.find(u => u.id === userId);
    if (user) {
      setFormData({
        ...formData,
        assigned_to_user_id: user.id,
        assigned_to_name: user.full_name || user.email
      });
    }
  };

  const handleVehicleChange = (vehicleId) => {
    if (!vehicleId) {
      setFormData({ ...formData, vehicle_id: '', vehicle_name: '' });
      return;
    }
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setFormData({
        ...formData,
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Clear Run</DialogTitle>
          <DialogDescription>
            Create a draft logistics run to clear {receiptCount} receipt{receiptCount !== 1 ? 's' : ''} from the loading bay.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="assigned_to_user">Assign to Technician (optional)</Label>
            <Select value={formData.assigned_to_user_id} onValueChange={handleTechnicianChange}>
              <SelectTrigger id="assigned_to_user">
                <SelectValue placeholder="Select technician..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None (unassigned)</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="vehicle">Vehicle (optional)</Label>
            <Select value={formData.vehicle_id} onValueChange={handleVehicleChange}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Select vehicle..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None (unassigned)</SelectItem>
                {vehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                    {vehicle.rego && ` (${vehicle.rego})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="target_location_id">Target Location ID (optional)</Label>
            <Input
              id="target_location_id"
              placeholder="e.g., warehouse storage location ID"
              value={formData.target_location_id}
              onChange={(e) => setFormData({ ...formData, target_location_id: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Run'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}