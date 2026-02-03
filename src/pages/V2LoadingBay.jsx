import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isPartsLogisticsV2PilotAllowed } from '@/components/utils/allowlist';
import { Package, Clock, AlertTriangle, CheckCircle, Camera, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function V2LoadingBay() {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

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

  // Compute summary stats
  const openCount = receipts.length;
  const dueSoon = receipts.filter(r => {
    const sla = computeSLA(r);
    return sla.status === 'Due Soon';
  }).length;
  const breached = receipts.filter(r => {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-h1 mb-2">Loading Bay (V2)</h1>
          <p className="text-secondary text-sm">Open receipts awaiting move (48h SLA)</p>
        </div>
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
          Normalize SLA from received_at
        </Button>
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
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Received</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Age</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">SLA</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Project</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">PO</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Photos</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => {
                    const sla = computeSLA(receipt);
                    const projectInfo = getProjectInfo(receipt.project_id);
                    const poInfo = getPOInfo(receipt.purchase_order_id);
                    const photoCount = getPhotoCount(receipt.photos_json);

                    return (
                      <tr key={receipt.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
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
                          {receipt.source_stop_id ? (
                            <Link
                              to={`${createPageUrl('V2Logistics')}`}
                              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                            >
                              View Stop
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-muted text-sm">-</span>
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
    </div>
  );
}