import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SAMPLE_LOCATION_TYPE } from "../domain/sampleConfig";
import { toast } from "sonner";

export default function ReassignHomeModal({ open, onClose, sample }) {
  const [homeLocationType, setHomeLocationType] = useState("");
  const [homeLocationReferenceId, setHomeLocationReferenceId] = useState("");
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  React.useEffect(() => {
    if (open && sample) {
      setHomeLocationType(sample.home_location_type || SAMPLE_LOCATION_TYPE.WAREHOUSE);
      setHomeLocationReferenceId(sample.home_location_reference_id || "");
    }
  }, [open, sample]);

  const updateMutation = useMutation({
    mutationFn: () => base44.entities.Sample.update(sample.id, {
      home_location_type: homeLocationType,
      home_location_reference_id: homeLocationReferenceId || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success("Home location updated");
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  if (!sample) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Home Location</DialogTitle>
          <DialogDescription>
            Set the default home location for: {sample.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="home_location_type">Home Location Type</Label>
            <Select
              value={homeLocationType}
              onValueChange={(value) => {
                setHomeLocationType(value);
                setHomeLocationReferenceId("");
              }}
            >
              <SelectTrigger id="home_location_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAMPLE_LOCATION_TYPE.WAREHOUSE}>Warehouse</SelectItem>
                <SelectItem value={SAMPLE_LOCATION_TYPE.VEHICLE}>Vehicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {homeLocationType === SAMPLE_LOCATION_TYPE.VEHICLE && (
            <div>
              <Label htmlFor="home_vehicle">Select Vehicle</Label>
              <Select
                value={homeLocationReferenceId}
                onValueChange={setHomeLocationReferenceId}
              >
                <SelectTrigger id="home_vehicle">
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
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {updateMutation.isPending ? "Updating..." : "Update Home"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}