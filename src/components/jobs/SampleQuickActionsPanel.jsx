import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowDown, CheckCircle } from "lucide-react";
import { getSampleStatusColor } from "../domain/sampleConfig";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export default function SampleQuickActionsPanel({ job, user }) {
  const [showDropModal, setShowDropModal] = useState(false);
  const [selectedForDrop, setSelectedForDrop] = useState([]);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedForPickup, setSelectedForPickup] = useState([]);
  const queryClient = useQueryClient();

  const isSampleJob = (job.job_type_name || job.job_type || '').toLowerCase().includes('sample');
  const isDropOffJob = isSampleJob && (job.job_type_name || job.job_type || '').toLowerCase().includes('drop');
  const isPickupJob = isSampleJob && (job.job_type_name || job.job_type || '').toLowerCase().includes('pickup');

  // Get samples in tech's vehicle
  const { data: vehicleSamples = [] } = useQuery({
    queryKey: ['techVehicleSamples', user?.email],
    queryFn: async () => {
      if (!user?.vehicle_id) return [];
      const samples = await base44.entities.Sample.filter({
        location_type: "Vehicle",
        location_reference_id: user.vehicle_id,
        status: "Active",
      });
      return samples;
    },
    enabled: !!user?.vehicle_id && !!job.project_id,
  });

  // Get samples at client (for pickup)
  const { data: clientSamples = [] } = useQuery({
    queryKey: ['clientSamples', job.project_id],
    queryFn: async () => {
      if (!job.project_id) return [];
      const samples = await base44.entities.Sample.filter({
        location_type: "With Client",
        location_reference_id: job.project_id,
        status: "Active",
      });
      return samples;
    },
    enabled: !!job.project_id,
  });

  const dropAtClientMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('recordSampleMovement', {
        sample_ids: selectedForDrop,
        from_location_type: "Vehicle",
        from_location_reference_id: user.vehicle_id,
        to_location_type: "With Client",
        to_location_reference_id: job.project_id,
        movement_type: "Drop at Client",
        linked_job_id: job.id,
        technician_id: user.email,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['techVehicleSamples'] });
      queryClient.invalidateQueries({ queryKey: ['clientSamples'] });
      toast.success(`${selectedForDrop.length} sample(s) dropped at client`);
      setShowDropModal(false);
      setSelectedForDrop([]);
    },
    onError: (error) => {
      toast.error(`Failed to drop samples: ${error.message}`);
    },
  });

  const confirmPickupMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('recordSampleMovement', {
        sample_ids: selectedForPickup,
        from_location_type: "With Client",
        from_location_reference_id: job.project_id,
        to_location_type: "Vehicle",
        to_location_reference_id: user.vehicle_id,
        movement_type: "Pick Up from Client",
        linked_job_id: job.id,
        technician_id: user.email,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['techVehicleSamples'] });
      queryClient.invalidateQueries({ queryKey: ['clientSamples'] });
      toast.success(`${selectedForPickup.length} sample(s) picked up`);
      setShowPickupModal(false);
      setSelectedForPickup([]);
    },
    onError: (error) => {
      toast.error(`Failed to pick up samples: ${error.message}`);
    },
  });

  // Don't show panel if not relevant
  if (!job.project_id || (!vehicleSamples.length && !clientSamples.length)) {
    return null;
  }

  return (
    <>
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="border-b border-[#E5E7EB] bg-purple-50/50 px-5 py-4">
          <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Sample Actions
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Drop samples */}
          {vehicleSamples.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-medium text-[#111827]">Samples in Your Vehicle</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {vehicleSamples.length} sample(s) available
                  </p>
                </div>
                <Button
                  onClick={() => setShowDropModal(true)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  Drop at Client
                </Button>
              </div>
            </div>
          )}

          {/* Pickup samples */}
          {clientSamples.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-medium text-[#111827]">Samples with Client</p>
                  <p className="text-[11px] text-[#6B7280]">
                    {clientSamples.length} sample(s) to pick up
                  </p>
                </div>
                <Button
                  onClick={() => setShowPickupModal(true)}
                  size="sm"
                  className="bg-purple-600 text-white hover:bg-purple-700 gap-2"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirm Pickup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drop Modal */}
      <Dialog open={showDropModal} onOpenChange={setShowDropModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Drop Samples at Client</DialogTitle>
            <DialogDescription>
              Select samples to leave with {job.customer_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="border border-[#E5E7EB] rounded-lg max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-[#E5E7EB]">
                {vehicleSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className="p-3 hover:bg-[#F9FAFB] cursor-pointer"
                    onClick={() => setSelectedForDrop(prev =>
                      prev.includes(sample.id) ? prev.filter(id => id !== sample.id) : [...prev, sample.id]
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedForDrop.includes(sample.id)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium">{sample.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getSampleStatusColor(sample.status)}`}>
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
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDropModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => dropAtClientMutation.mutate()}
                disabled={selectedForDrop.length === 0 || dropAtClientMutation.isPending}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                Drop {selectedForDrop.length > 0 && `(${selectedForDrop.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pickup Modal */}
      <Dialog open={showPickupModal} onOpenChange={setShowPickupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Sample Pickup</DialogTitle>
            <DialogDescription>
              Select samples you're picking up from {job.customer_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="border border-[#E5E7EB] rounded-lg max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-[#E5E7EB]">
                {clientSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className="p-3 hover:bg-[#F9FAFB] cursor-pointer"
                    onClick={() => setSelectedForPickup(prev =>
                      prev.includes(sample.id) ? prev.filter(id => id !== sample.id) : [...prev, sample.id]
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedForPickup.includes(sample.id)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium">{sample.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getSampleStatusColor(sample.status)}`}>
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
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPickupModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmPickupMutation.mutate()}
                disabled={selectedForPickup.length === 0 || !user?.vehicle_id || confirmPickupMutation.isPending}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                Confirm Pickup {selectedForPickup.length > 0 && `(${selectedForPickup.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}