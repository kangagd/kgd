import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { LOCATION_TYPE, MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";
import { PART_LOCATION } from "@/components/domain/partConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

export default function AssignPartToVehicleModal({ 
  open, 
  onClose, 
  part, 
  project, 
  defaultQuantity, 
  onAssigned 
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [quantity, setQuantity] = useState(defaultQuantity || 1);
  const queryClient = useQueryClient();

  // Fetch vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles-for-part-assignment"],
    queryFn: () => base44.entities.Vehicle.list("name"),
    enabled: open,
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!part || !selectedVehicleId) return;

      // 1. Update Part
      await base44.entities.Part.update(part.id, {
        location: PART_LOCATION.VEHICLE,
        assigned_vehicle_id: selectedVehicleId,
        status: "in_vehicle",
      });

      // 2. Create Stock Movement (Warehouse -> Vehicle)
      // Only if we have a price_list_item_id to track
      if (part.price_list_item_id) {
        try {
          await base44.entities.StockMovement.create({
            price_list_item_id: part.price_list_item_id,
            quantity: Number(quantity),
            movement_type: MOVEMENT_TYPE.TRANSFER,
            from_location_type: LOCATION_TYPE.WAREHOUSE,
            from_location_id: "warehouse_main", 
            to_location_type: LOCATION_TYPE.VEHICLE,
            to_location_id: selectedVehicleId,
            job_id: null, // Can be linked to job if known, but this is project level
            project_id: project?.id || part.project_id || null,
            technician_id: null,
            created_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to create stock movement:", err);
          // Don't block success if just movement logging fails
        }
      }
    },
    onSuccess: () => {
      toast.success("Part assigned to vehicle");
      if (onAssigned) onAssigned();
      handleClose();
    },
    onError: (error) => {
      console.error("Assignment error:", error);
      toast.error("Failed to assign part");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      toast.error("Please select a vehicle");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    assignMutation.mutate();
  };

  const handleClose = () => {
    setSelectedVehicleId("");
    setQuantity(defaultQuantity || 1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Assign Part to Vehicle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Part</Label>
            <div className="text-sm font-medium text-gray-900 p-2 bg-gray-50 rounded border">
              {part?.category || "Unknown Part"}
              {part?.supplier_name && <span className="text-gray-500 ml-2 text-xs">({part.supplier_name})</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Vehicle</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {vehiclesLoading ? (
                  <div className="p-2 text-xs text-gray-500 text-center">Loading vehicles...</div>
                ) : (
                  vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name || vehicle.registration_plate || "Vehicle"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={assignMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}