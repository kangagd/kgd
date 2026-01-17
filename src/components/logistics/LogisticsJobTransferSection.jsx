import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Clock, ArrowRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

const transferStatusConfig = {
  'not_started': { icon: Clock, color: 'bg-gray-100 text-gray-800', label: 'Not Started' },
  'pending': { icon: Clock, color: 'bg-amber-100 text-amber-800', label: 'Pending' },
  'completed': { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Completed' },
  'skipped': { icon: AlertCircle, color: 'bg-slate-100 text-slate-800', label: 'Skipped' }
};

export default function LogisticsJobTransferSection({ job, sourceLocation, destinationLocation, isAdmin = false }) {
  const queryClient = useQueryClient();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [notes, setNotes] = useState('');

  const status = job.stock_transfer_status || 'not_started';
  const config = transferStatusConfig[status];
  const Icon = config.icon;
  const isLegacy = job.legacy_flag === true;

  const recordTransferMutation = useMutation({
    mutationFn: async () => {
      // Validate selections
      const itemsToTransfer = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => ({ price_list_item_id: itemId, quantity: qty }));

      if (itemsToTransfer.length === 0) {
        throw new Error('Please select at least one item to transfer');
      }

      const response = await base44.functions.invoke('recordLogisticsJobTransfer', {
        job_id: job.id,
        source_location_id: sourceLocation?.id,
        destination_location_id: destinationLocation?.id,
        items: itemsToTransfer,
        notes: notes
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to record transfer');
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Transferred ${data.items_transferred} item(s)`);
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['inventoryQuantities'] });
      setShowTransferModal(false);
      setSelectedItems({});
      setNotes('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to record transfer');
    }
  });

  // Show different UI based on job type
  const isWarehouseTransfer = destinationLocation?.type === 'vehicle' && sourceLocation?.type === 'warehouse';
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">From Location</div>
            <div className="font-medium text-gray-900">
              {sourceLocation?.name || '—'}
            </div>
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
            <p className="text-sm text-amber-800">Source location not configured. Cannot record transfer.</p>
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

        {/* Record Transfer Button */}
        {canTransfer && (
          <Button
            onClick={() => setShowTransferModal(true)}
            className="w-full bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            disabled={!sourceLocation || !destinationLocation}
          >
            Record Transfer
          </Button>
        )}

        {/* Admin-Only Legacy Helper Button */}
        {isLegacy && isAdmin && (
          <Button
            onClick={() => setShowTransferModal(true)}
            variant="outline"
            className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            Link Inventory Transfer (Admin)
          </Button>
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

      {/* Transfer Modal */}
      <TransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        sourceLocation={sourceLocation}
        destinationLocation={destinationLocation}
        onConfirm={() => recordTransferMutation.mutate()}
        isLoading={recordTransferMutation.isPending}
        notes={notes}
        onNotesChange={setNotes}
      />
    </Card>
  );
}

function TransferModal({ open, onOpenChange, sourceLocation, destinationLocation, onConfirm, isLoading, notes, onNotesChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Inventory Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">From</div>
            <div className="font-medium">{sourceLocation?.name}</div>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">To</div>
            <div className="font-medium">{destinationLocation?.name}</div>
          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="e.g., Transferred for job completion"
              className="mt-1"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            You'll be prompted to enter quantities for each item being transferred on the next step.
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}