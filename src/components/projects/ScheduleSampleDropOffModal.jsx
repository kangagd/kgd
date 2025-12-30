import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getSampleStatusColor } from "../domain/sampleConfig";
import { toast } from "sonner";

export default function ScheduleSampleDropOffModal({ open, onClose, project }) {
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceLocation, setSourceLocation] = useState("warehouse");
  const queryClient = useQueryClient();

  const { data: warehouseSamples = [] } = useQuery({
    queryKey: ['warehouseSamples'],
    queryFn: async () => {
      const samples = await base44.entities.SampleV2.filter({
        current_location_type: "warehouse",
        status: "active",
      });
      return samples;
    },
    enabled: open,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const { data: vehicleSamples = [] } = useQuery({
    queryKey: ['vehicleSamplesForDropOff', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      const allSamples = await base44.entities.SampleV2.list();
      // Show samples currently in vehicle OR those whose home is this vehicle
      const filtered = allSamples.filter(s => 
        s.status === "active" && (
          (s.current_location_type === "vehicle" && s.current_location_reference_id === vehicleId) ||
          (s.home_location_type === "vehicle" && s.home_location_reference_id === vehicleId)
        )
      );
      return filtered;
    },
    enabled: open && sourceLocation === "vehicle" && !!vehicleId,
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('createSampleLogisticsJob', {
        project_id: project.id,
        vehicle_id: vehicleId || null,
        sample_ids: selectedSampleIds,
        job_type: "Sample Drop-Off",
        scheduled_date: scheduledDate || null,
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientSamples'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success("Sample drop-off job scheduled");
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to schedule drop-off: ${error.message}`);
    },
  });

  const handleClose = () => {
    setSelectedSampleIds([]);
    setVehicleId("");
    setScheduledDate("");
    setNotes("");
    setSourceLocation("warehouse");
    onClose();
  };

  const toggleSample = (sampleId) => {
    setSelectedSampleIds(prev =>
      prev.includes(sampleId)
        ? prev.filter(id => id !== sampleId)
        : [...prev, sampleId]
    );
  };

  const availableSamples = sourceLocation === "warehouse" ? warehouseSamples : vehicleSamples;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Sample Drop-Off</DialogTitle>
          <DialogDescription>
            Create a logistics job to deliver samples to {project.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Source Location</Label>
            <Tabs value={sourceLocation} onValueChange={setSourceLocation}>
              <TabsList className="w-full">
                <TabsTrigger value="warehouse" className="flex-1">From Warehouse</TabsTrigger>
                <TabsTrigger value="vehicle" className="flex-1">From Vehicle</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {sourceLocation === "vehicle" && (
            <div>
              <Label htmlFor="vehicle">Select Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Choose vehicle" />
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
            <Label>Select Samples</Label>
            <div className="border border-[#E5E7EB] rounded-lg max-h-[300px] overflow-y-auto">
              {availableSamples.length === 0 ? (
                <div className="text-center py-8 text-[#6B7280]">
                  {sourceLocation === "vehicle" && !vehicleId 
                    ? "Select a vehicle first"
                    : "No samples available"
                  }
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {availableSamples.map((sample) => (
                    <div
                      key={sample.id}
                      className="p-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                      onClick={() => toggleSample(sample.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSampleIds.includes(sample.id)}
                          onCheckedChange={() => toggleSample(sample.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[14px] font-medium text-[#111827]">
                              {sample.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${getSampleStatusColor(sample.status)}`}
                            >
                              {sample.status}
                            </Badge>
                          </div>
                          {sample.category && (
                            <p className="text-[12px] text-[#6B7280]">{sample.category}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="scheduled_date">Scheduled Date (Optional)</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          {sourceLocation === "warehouse" && (
            <div>
              <Label htmlFor="delivery_vehicle">Delivery Vehicle (Optional)</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id="delivery_vehicle">
                  <SelectValue placeholder="Choose vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No vehicle selected</SelectItem>
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
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this drop-off..."
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[#E5E7EB]">
            <div className="text-[13px] text-[#6B7280]">
              {selectedSampleIds.length} sample(s) selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => createJobMutation.mutate()}
                disabled={selectedSampleIds.length === 0 || createJobMutation.isPending}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {createJobMutation.isPending ? "Creating..." : "Schedule Drop-Off"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}