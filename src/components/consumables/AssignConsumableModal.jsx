import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function AssignConsumableModal({ open, onClose, consumable, vehicles }) {
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [defaultQuantity, setDefaultQuantity] = useState(1);
  const [defaultCondition, setDefaultCondition] = useState("Full");

  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async () => {
      const promises = selectedVehicles.map(vehicleId =>
        base44.entities.VehicleConsumableAssignment.create({
          vehicle_id: vehicleId,
          consumable_id: consumable.id,
          consumable_name: consumable.name,
          quantity_present: defaultQuantity,
          condition: defaultCondition,
          last_checked_at: new Date().toISOString(),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-consumables']);
      toast.success("Consumable assigned to selected vehicles");
      onClose();
      setSelectedVehicles([]);
    },
    onError: (error) => {
      toast.error("Failed to assign consumable: " + error.message);
    },
  });

  const handleToggleVehicle = (vehicleId) => {
    setSelectedVehicles(prev =>
      prev.includes(vehicleId)
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedVehicles.length === 0) {
      toast.error("Please select at least one vehicle");
      return;
    }
    assignMutation.mutate();
  };

  if (!consumable) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign "{consumable.name}" to Vehicles</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Select Vehicles</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {vehicles.map(vehicle => (
                <div key={vehicle.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedVehicles.includes(vehicle.id)}
                    onCheckedChange={() => handleToggleVehicle(vehicle.id)}
                  />
                  <label className="text-sm cursor-pointer" onClick={() => handleToggleVehicle(vehicle.id)}>
                    {vehicle.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Default Quantity</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label>Default Condition</Label>
            <Select value={defaultCondition} onValueChange={setDefaultCondition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Full">Full</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Empty">Empty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignMutation.isLoading} className="bg-[#FAE008] hover:bg-[#E5CF07] text-black">
              {assignMutation.isLoading ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}