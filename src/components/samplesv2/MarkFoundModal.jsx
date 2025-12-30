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

export default function MarkFoundModal({ open, onClose, sample }) {
  const [foundLocationType, setFoundLocationType] = useState('warehouse');
  const [vehicleId, setVehicleId] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const markFoundMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('manageSampleV2', {
        action: 'markFound',
        sample_id: sample.id,
        found_location_type: foundLocationType,
        vehicle_id: foundLocationType === 'vehicle' ? vehicleId : undefined,
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samplesV2'] });
      toast.success('Sample marked as found');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to mark sample as found: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (foundLocationType === 'vehicle' && !vehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    markFoundMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Sample as Found</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
            <p className="text-[13px] text-[#6B7280]">Sample</p>
            <p className="text-[14px] font-medium text-[#111827]">{sample.name}</p>
          </div>

          <div>
            <Label htmlFor="found_location">Found Location *</Label>
            <Select value={foundLocationType} onValueChange={setFoundLocationType}>
              <SelectTrigger id="found_location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {foundLocationType === 'vehicle' && (
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
              placeholder="Where was it found? Any damage?"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={markFoundMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {markFoundMutation.isPending ? 'Marking Found...' : 'Mark Found'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}