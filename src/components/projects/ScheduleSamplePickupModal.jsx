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
import { getSampleStatusColor } from "../domain/sampleConfig";
import { toast } from "sonner";

export default function ScheduleSamplePickupModal({ open, onClose, project, clientSamples }) {
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      if (!vehicleId) {
        throw new Error("Please select a vehicle for pickup");
      }

      const result = await base44.functions.invoke('createSampleLogisticsJob', {
        project_id: project.id,
        vehicle_id: vehicleId,
        sample_ids: selectedSampleIds,
        job_type: "Sample Pickup",
        scheduled_date: scheduledDate || null,
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientSamples'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success("Sample pickup job scheduled");
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to schedule pickup: ${error.message}`);
    },
  });

  const handleClose = () => {
    setSelectedSampleIds([]);
    setVehicleId("");
    setScheduledDate("");
    setNotes("");
    onClose();
  };

  const toggleSample = (sampleId) => {
    setSelectedSampleIds(prev =>
      prev.includes(sampleId)
        ? prev.filter(id => id !== sampleId)
        : [...prev, sampleId]
    );
  };

  const toggleAll = () => {
    if (selectedSampleIds.length === clientSamples.length) {
      setSelectedSampleIds([]);
    } else {
      setSelectedSampleIds(clientSamples.map(s => s.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Sample Pickup</DialogTitle>
          <DialogDescription>
            Create a logistics job to pick up samples from {project.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pickup_vehicle">Pickup Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger id="pickup_vehicle">
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Samples to Pick Up</Label>
              {clientSamples.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="text-[12px] h-7"
                >
                  {selectedSampleIds.length === clientSamples.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            <div className="border border-[#E5E7EB] rounded-lg max-h-[300px] overflow-y-auto">
              {clientSamples.length === 0 ? (
                <div className="text-center py-8 text-[#6B7280]">
                  No samples with this client
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {clientSamples.map((sample) => (
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
            <Label htmlFor="pickup_scheduled_date">Scheduled Date (Optional)</Label>
            <Input
              id="pickup_scheduled_date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="pickup_notes">Notes (Optional)</Label>
            <Input
              id="pickup_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this pickup..."
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
                disabled={selectedSampleIds.length === 0 || !vehicleId || createJobMutation.isPending}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {createJobMutation.isPending ? "Creating..." : "Schedule Pickup"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}