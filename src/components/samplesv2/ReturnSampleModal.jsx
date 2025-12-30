import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ReturnSampleModal({ open, onClose, sample }) {
  const [returnTo, setReturnTo] = useState('home');
  const [vehicleId, setVehicleId] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('manageSampleV2', {
        action: 'returnSample',
        sample_id: sample.id,
        return_to: returnTo,
        vehicle_id: returnTo === 'vehicle' ? vehicleId : undefined,
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samplesV2'] });
      toast.success('Sample returned successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to return sample: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (returnTo === 'vehicle' && !vehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    returnMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Sample</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
            <p className="text-[13px] text-[#6B7280]">Sample</p>
            <p className="text-[14px] font-medium text-[#111827]">{sample.name}</p>
          </div>

          <div>
            <Label htmlFor="return_to">Return To *</Label>
            <Select value={returnTo} onValueChange={setReturnTo}>
              <SelectTrigger id="return_to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home Location</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {returnTo === 'vehicle' && (
            <div>
              <Label htmlFor="vehicle">Select Vehicle *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name || v.registration_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={returnMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {returnMutation.isPending ? 'Returning...' : 'Return Sample'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}