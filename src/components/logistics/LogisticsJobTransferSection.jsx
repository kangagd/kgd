import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Clock, ArrowRight, Loader2, Lock, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const transferStatusConfig = {
  'not_started': { icon: Clock, color: 'bg-gray-100 text-gray-800', label: 'Not Started' },
  'pending': { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'Pending' },
  'completed': { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Completed' },
  'skipped': { icon: AlertCircle, color: 'bg-slate-100 text-slate-800', label: 'Skipped' }
};

export default function LogisticsJobTransferSection({ job, sourceLocation, destinationLocation }) {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState({});
  const [notes, setNotes] = useState('');
  const [editingLocations, setEditingLocations] = useState(false);

  // Fetch all inventory locations for the dropdowns
  const { data: allLocations = [] } = useQuery({
    queryKey: ['inventoryLocations'],
    queryFn: () => base44.entities.InventoryLocation.filter({ is_active: true }),
    enabled: editingLocations,
  });

  // Fetch parts for this logistics job (always fetch, not just in modal)
  const { data: jobParts = [] } = useQuery({
    queryKey: ['jobParts', job.id, job.purchase_order_id, job.visit_scope],
    queryFn: async () => {
      const uniqueParts = new Map();
      
      // Method 1: PO-based lookup (for supplier/procurement jobs)
      if (job.purchase_order_id) {
        const parts = await base44.entities.Part.filter({ 
          primary_purchase_order_id: job.purchase_order_id 
        });
        parts.forEach(p => uniqueParts.set(p.id, p));
      }
      
      // Fallback: Also check legacy purchase_order_id field
      if (job.purchase_order_id) {
        const legacyParts = await base44.entities.Part.filter({ 
          purchase_order_id: job.purchase_order_id 
        });
        legacyParts.forEach(p => uniqueParts.set(p.id, p));
      }
      
      if (uniqueParts.size > 0) {
        return Array.from(uniqueParts.values());
      }
      
      // Method 2: Fallback to linked_logistics_jobs (most reliable)
      const allParts = await base44.entities.Part.list();
      const linkedParts = allParts.filter(p => 
        p.linked_logistics_jobs && 
        Array.isArray(p.linked_logistics_jobs) && 
        p.linked_logistics_jobs.includes(job.id)
      );
      
      if (linkedParts.length > 0) {
        return linkedParts;
      }
      
      // Fallback: Extract part IDs from visit_scope if no linked parts found
      const partIdsFromScope = (job.visit_scope || [])
        .filter(item => item.type === 'part' && item.ref_id)
        .map(item => item.ref_id);
      
      if (partIdsFromScope.length > 0) {
        return allParts.filter(p => partIdsFromScope.includes(p.id));
      }
      
      return [];
    },
  });

  const status = job.stock_transfer_status || 'not_started';
  const config = transferStatusConfig[status];
  const Icon = config.icon;
  const isLegacy = job.legacy_flag === true;

  const updateLocationsMutation = useMutation({
    mutationFn: async ({ sourceLocationId, destinationLocationId }) => {
      const user = await base44.auth.me();
      await base44.entities.Job.update(job.id, {
        source_location_id: sourceLocationId,
        destination_location_id: destinationLocationId,
        locations_manually_set: true,
        locations_manually_set_at: new Date().toISOString(),
        locations_manually_set_by_user_id: user?.id || undefined
      });
    },
    onSuccess: () => {
      toast.success('Locations updated (manual override enabled)');
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      setEditingLocations(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update locations');
    }
  });

  const resetLocationsMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Job.update(job.id, {
        locations_manually_set: false
      });
    },
    onSuccess: () => {
      toast.success('Manual override removed - inference re-enabled');
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reset locations');
    }
  });

  // Show different UI based on job type
  const isWarehouseTransfer = destinationLocation?.type === 'vehicle' && sourceLocation?.type === 'warehouse';
  // Require both locations (supplier locations now exist as InventoryLocations)
  const canTransfer = sourceLocation && destinationLocation && status !== 'completed' && !isLegacy;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[18px] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Inventory Transfer
          </span>
          <Badge className={config.color}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Summary */}
        {!editingLocations ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Transfer Route</div>
              {status !== 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingLocations(true)}
                  className="h-8 gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">From Location</div>
                <div className="font-medium text-gray-900">
                  {sourceLocation?.name || '—'}
                </div>
                {sourceLocation?.address && (
                  <div className="text-xs text-gray-500 mt-1">{sourceLocation.address}</div>
                )}
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">To Location</div>
                <div className="font-medium text-gray-900">
                  {destinationLocation?.name || '—'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div className="text-sm font-medium text-blue-900">Edit Transfer Route</div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">From Location</Label>
                <Select
                  value={job.source_location_id || ''}
                  onValueChange={(value) => {
                    const destId = job.destination_location_id;
                    updateLocationsMutation.mutate({ 
                      sourceLocationId: value || null, 
                      destinationLocationId: destId || null 
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select source location" />
                  </SelectTrigger>
                  <SelectContent>
                    {allLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">To Location</Label>
                <Select
                  value={job.destination_location_id || ''}
                  onValueChange={(value) => {
                    const srcId = job.source_location_id;
                    updateLocationsMutation.mutate({ 
                      sourceLocationId: srcId || null, 
                      destinationLocationId: value || null 
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    {allLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingLocations(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                {job.locations_manually_set && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetLocationsMutation.mutate();
                      setEditingLocations(false);
                    }}
                    disabled={resetLocationsMutation.isPending}
                    className="flex-1 text-amber-600 hover:bg-amber-50"
                  >
                    {resetLocationsMutation.isPending ? 'Resetting...' : 'Reset to Auto'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        {status === 'completed' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900">Transfer Completed</p>
              {job.linked_stock_movement_batch_id && (
                <p className="text-xs text-green-700 mt-1">Batch ID: {job.linked_stock_movement_batch_id}</p>
              )}
            </div>
          </div>
        )}

        {status === 'skipped' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">Transfer Skipped</p>
              <p className="text-xs text-slate-700 mt-1">No inventory transfer recorded for this job</p>
            </div>
          </div>
        )}

        {!sourceLocation && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Source location not configured. Run backfill migration to create supplier locations.</p>
          </div>
        )}

        {!destinationLocation && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Destination location not configured. Cannot record transfer.</p>
          </div>
        )}

        {/* Legacy Job Warning */}
        {isLegacy && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-2">
            <Lock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Legacy Job - No Automatic Actions</p>
              <p className="text-xs mt-1">Inventory changes were not automatically tracked for this legacy job. Only admins can manually link inventory transfers.</p>
            </div>
          </div>
        )}

        {/* Inline Stock Processing Section */}
        {(canTransfer || isLegacy) && (
          <InlineStockProcessor
            job={job}
            jobParts={jobParts}
            sourceLocation={sourceLocation}
            destinationLocation={destinationLocation}
            selectedItems={selectedItems}
            onSelectedItemsChange={setSelectedItems}
            notes={notes}
            onNotesChange={setNotes}
            isLegacy={isLegacy}
          />
        )}

        {/* Info */}
        <div className={`p-3 border rounded-lg text-sm ${
          isLegacy 
            ? 'bg-orange-50 border-orange-200 text-orange-900' 
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <p className="font-medium mb-1">
            {isLegacy ? 'About Legacy Jobs' : 'About Inventory Transfers'}
          </p>
          <p className="text-xs leading-relaxed">
            {isLegacy 
              ? 'This job was created before inventory tracking was implemented. Stock was not automatically tracked during delivery. To record inventory that should have been transferred, use "Link Inventory Transfer" to manually create audit records.'
              : 'Completing this logistics job does NOT automatically move stock. Use "Record Transfer" to explicitly record inventory movement between locations, which updates stock quantities and creates an audit trail.'
            }
          </p>
        </div>
      </CardContent>


    </Card>
  );
}

function InlineStockProcessor({ job, jobParts = [], sourceLocation, destinationLocation, selectedItems, onSelectedItemsChange, notes, onNotesChange, isLegacy }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingErrorDetails, setProcessingErrorDetails] = useState(null);
  const queryClient = useQueryClient();

  const selectedCount = Object.values(selectedItems).filter(qty => qty > 0).length;

  const getActionLabel = () => {
    const purpose = job.logistics_purpose || '';
    if (purpose.includes('pickup_from_supplier') || purpose.includes('po_pickup')) return 'Receive Items';
    if (purpose.includes('delivery') || purpose.includes('po_delivery')) return 'Receive Items';
    if (isLegacy) return 'Link Inventory Transfer';
    return 'Complete Transfer';
  };

  // Determine mode based on job context
  const getMode = () => {
    const isPoJob = !!job?.purchase_order_id;
    const purpose = (job?.logistics_purpose || '').toLowerCase();
    const isPoReceiveFlow = isPoJob && (
      purpose.includes('po_') ||
      purpose.includes('pickup') ||
      purpose.includes('delivery') ||
      purpose.includes('receive')
    );
    return isPoReceiveFlow ? 'po_receipt' : 'transfer';
  };

  const mode = getMode();

  // Filter items based on mode
  const validItems = jobParts.filter(part => {
    if (mode === 'po_receipt') return !!part.po_line_id;
    return !!part.price_list_item_id;
  });

  const getModeLabel = () => mode === 'po_receipt' ? 'Processing PO Receipt' : 'Transferring Stock';
  const getQtyLabel = () => mode === 'po_receipt' ? 'Qty Received' : 'Qty to Transfer';
  const canProcess = sourceLocation && destinationLocation && selectedCount > 0 && !isProcessing;

  const handleProcess = async () => {
    try {
      setIsProcessing(true);
      setProcessingErrorDetails(null);

      // Build payload based on mode
      let payload = {
        job_id: job.id,
        mode: mode,
        notes: notes || undefined
      };

      if (mode === 'po_receipt') {
        // PO receipt mode: validate destination location and build items list
        const locationId = destinationLocation?.id;
        if (!locationId) {
          toast.error('Destination location required to receive items');
          setIsProcessing(false);
          return;
        }

        // Extract PO line IDs from parts
        const itemsForReceipt = Object.entries(selectedItems)
          .filter(([_, qty]) => qty > 0)
          .map(([partId, qty]) => {
            const part = jobParts.find(p => p.id === partId);
            return {
              purchase_order_line_id: part?.po_line_id || null,
              qty: parseFloat(qty)
            };
          });

        // Validate all items have po_line_id
        const missingLineIds = itemsForReceipt.filter(i => !i.purchase_order_line_id);
        if (missingLineIds.length > 0) {
          toast.error('Some selected items are missing PO line links (po_line_id)');
          setIsProcessing(false);
          return;
        }

        if (itemsForReceipt.length === 0) {
          toast.error('No valid items selected');
          setIsProcessing(false);
          return;
        }

        payload.location_id = locationId;
        payload.items = itemsForReceipt;
      } else {
        // Transfer mode: validate both locations and build transfer_items
        const fromId = sourceLocation?.id;
        const toId = destinationLocation?.id;
        if (!fromId || !toId) {
          toast.error('From and To locations required for transfer');
          setIsProcessing(false);
          return;
        }

        const transferItems = Object.entries(selectedItems)
          .filter(([_, qty]) => qty > 0)
          .map(([partId, qty]) => {
            const part = jobParts.find(p => p.id === partId);
            return {
              price_list_item_id: part?.price_list_item_id || null,
              qty: parseFloat(qty)
            };
          });

        // Validate all items have price_list_item_id
        const missingSkus = transferItems.filter(i => !i.price_list_item_id);
        if (missingSkus.length > 0) {
          toast.error('Some selected items are missing SKU links (price_list_item_id)');
          setIsProcessing(false);
          return;
        }

        if (transferItems.length === 0) {
          toast.error('No valid items selected');
          setIsProcessing(false);
          return;
        }

        payload.from_location_id = fromId;
        payload.to_location_id = toId;
        payload.transfer_items = transferItems;
      }

      // Invoke backend
      const response = await base44.functions.invoke('processLogisticsJobStockActions', payload);

      if (!response.data?.success) {
        // Check if response has item-level failures
        const failures = response.data?.details?.failures;
        if (failures && Array.isArray(failures)) {
          setProcessingErrorDetails(failures);
          toast.error(`${failures.length} item(s) failed to process`);
        } else {
          throw new Error(response.data?.error || 'Failed to process stock');
        }
        return;
      }

      toast.success(`Stock processed: ${response.data.items_processed} item(s)`);
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      
      // Reset form only on success
      onSelectedItemsChange({});
      onNotesChange('');
      setProcessingErrorDetails(null);
    } catch (error) {
      toast.error(error.message || 'Failed to process stock');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-blue-900">Stock Processing</div>
        <div className="px-2.5 py-1 bg-blue-100 border border-blue-300 rounded text-xs font-medium text-blue-900">
          {getModeLabel()}
        </div>
      </div>

      {validItems.length === 0 ? (
        <div className="text-sm text-blue-700">
          No {mode === 'po_receipt' ? 'PO line items' : 'parts with SKU tracking'} found for this logistics job
          <br />
          <span className="text-xs text-blue-600">Total parts: {jobParts.length} | Valid for {getModeLabel()}: {validItems.length}</span>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Items to Process</Label>
              <span className="text-xs text-blue-700">{getQtyLabel()}</span>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {validItems.map((part) => (
                <div key={part.id} className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{part.item_name || 'Unnamed Part'}</div>
                    <div className="text-xs text-gray-500">Required: {part.quantity_required || 1}</div>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qty"
                      value={selectedItems[part.id] || ''}
                      onChange={(e) => onSelectedItemsChange({ ...selectedItems, [part.id]: parseFloat(e.target.value) || 0 })}
                      disabled={isProcessing}
                      className="h-8 text-sm"
                    />
                  </div>
                  {selectedItems[part.id] > 0 && (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  )}
                </div>
              ))}
            </div>
            {selectedCount > 0 && (
              <div className="text-xs text-green-700 font-medium">{selectedCount} item(s) selected</div>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Notes (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="e.g., Stock verified and counted"
              disabled={isProcessing}
              className="mt-1 h-8 text-sm"
            />
          </div>

          <Button
            onClick={handleProcess}
            disabled={!canProcess}
            className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {getActionLabel()} {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>

          {/* Item-level failure details */}
          {processingErrorDetails && processingErrorDetails.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900 mb-2">Some items failed</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {processingErrorDetails.map((failure, idx) => (
                  <div key={idx} className="text-xs text-red-800 p-2 bg-white rounded border border-red-100">
                    <span className="font-medium">{failure.price_list_item_id || failure.purchase_order_line_id}</span>
                    {' • Qty: '}{failure.qty}
                    {' • '}<span className="italic">{failure.error}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-700 mt-2">Review and try again</p>
            </div>
          )}
          </>
          )}
          </div>
          );
          }