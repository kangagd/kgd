import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function TransferSampleModal({ sample, open, onClose }) {
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const transferMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.functions.invoke('manageSample', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sampleMovements'] });
      toast.success('Sample transferred successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to transfer sample');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!vehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    
    transferMutation.mutate({
      action: 'transferToVehicle',
      sample_id: sample.id,
      vehicle_id: vehicleId,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Sample to Vehicle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={transferMutation.isPending}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}