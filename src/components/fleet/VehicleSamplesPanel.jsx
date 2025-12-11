import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getSampleStatusColor } from "../domain/sampleConfig";
import CheckInSampleModal from "./CheckInSampleModal";
import { toast } from "sonner";

export default function VehicleSamplesPanel({ vehicle }) {
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['vehicleSamples', vehicle.id],
    queryFn: async () => {
      const allSamples = await base44.entities.Sample.filter({
        location_type: "Vehicle",
        location_reference_id: vehicle.id,
      });
      return allSamples;
    },
  });

  const { data: sampleMovements = [] } = useQuery({
    queryKey: ['sampleMovements', vehicle.id],
    queryFn: async () => {
      const movements = await base44.entities.SampleMovement.list('-created_date', 100);
      return movements;
    },
    enabled: samples.length > 0,
  });

  const returnToWarehouseMutation = useMutation({
    mutationFn: async (sample_id) => {
      const result = await base44.functions.invoke('recordSampleMovement', {
        sample_ids: [sample_id],
        from_location_type: "Vehicle",
        from_location_reference_id: vehicle.id,
        to_location_type: "Warehouse",
        to_location_reference_id: null,
        movement_type: "Return to Warehouse",
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleSamples'] });
      queryClient.invalidateQueries({ queryKey: ['sampleMovements'] });
      toast.success("Sample returned to warehouse");
    },
    onError: (error) => {
      toast.error(`Failed to return sample: ${error.message}`);
    },
  });

  const getDaysInVehicle = (sample_id) => {
    // Find the most recent movement TO this vehicle for this sample
    const relevantMovements = sampleMovements.filter(
      m => m.sample_id === sample_id && 
           m.to_location_type === "Vehicle" &&
           m.to_location_reference_id === vehicle.id
    );

    if (relevantMovements.length === 0) return null;

    // Get the most recent one
    const lastMovement = relevantMovements.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    )[0];

    const days = Math.floor((Date.now() - new Date(lastMovement.created_date)) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <>
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="border-b border-[#E5E7EB] bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Samples in Vehicle
              {samples.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                  {samples.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              onClick={() => setShowCheckInModal(true)}
              variant="outline"
              className="gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Check In Sample
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {isLoading && (
            <div className="text-center py-8 text-[#6B7280]">
              Loading samples...
            </div>
          )}

          {!isLoading && samples.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
              <p className="text-[14px] text-[#6B7280]">No samples in this vehicle</p>
              <Button
                onClick={() => setShowCheckInModal(true)}
                variant="outline"
                className="mt-4 gap-2"
              >
                <Plus className="w-4 h-4" />
                Check In Sample from Warehouse
              </Button>
            </div>
          )}

          {!isLoading && samples.length > 0 && (
            <div className="space-y-3">
              {samples.map((sample) => {
                const daysInVehicle = getDaysInVehicle(sample.id);
                const isLongInVehicle = daysInVehicle !== null && daysInVehicle > 30;

                return (
                  <div
                    key={sample.id}
                    className="flex items-start justify-between p-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[14px] font-medium text-[#111827]">
                          {sample.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${getSampleStatusColor(sample.status)}`}
                        >
                          {sample.status}
                        </Badge>
                        {isLongInVehicle && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Long in vehicle
                          </Badge>
                        )}
                      </div>
                      {sample.category && (
                        <p className="text-[12px] text-[#6B7280] mb-1">
                          {sample.category}
                        </p>
                      )}
                      {sample.sample_tag && (
                        <p className="text-[12px] text-[#6B7280] font-mono">
                          Tag: {sample.sample_tag}
                        </p>
                      )}
                      {daysInVehicle !== null && (
                        <p className="text-[11px] text-[#9CA3AF] mt-1">
                          In vehicle for {daysInVehicle} {daysInVehicle === 1 ? 'day' : 'days'}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => returnToWarehouseMutation.mutate(sample.id)}
                      disabled={returnToWarehouseMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="ml-3 gap-2 flex-shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Return to Warehouse
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CheckInSampleModal
        open={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        vehicle={vehicle}
      />
    </>
  );
}