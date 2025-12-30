import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ReturnSampleModal({ sample, open, onClose }) {
  const queryClient = useQueryClient();
  const [returnTo, setReturnTo] = useState("home");
  const [vehicleId, setVehicleId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const returnMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.functions.invoke('manageSample', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['sampleMovements'] });
      toast.success('Sample returned successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to return sample');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (returnTo === 'vehicle' && !vehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    
    returnMutation.mutate({
      action: 'returnSample',
      sample_id: sample.id,
      return_to: returnTo,
      vehicle_id: returnTo === 'vehicle' ? vehicleId : undefined,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return Sample</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Return Destination</Label>
            <RadioGroup value={returnTo} onValueChange={setReturnTo} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="home" id="home" />
                <Label htmlFor="home" className="font-normal cursor-pointer">
                  Home Location (Default)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="warehouse" id="warehouse" />
                <Label htmlFor="warehouse" className="font-normal cursor-pointer">
                  Warehouse
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vehicle" id="vehicle" />
                <Label htmlFor="vehicle" className="font-normal cursor-pointer">
                  Specific Vehicle
                </Label>
              </div>
            </RadioGroup>
          </div>

          {returnTo === 'vehicle' && (
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
          )}

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