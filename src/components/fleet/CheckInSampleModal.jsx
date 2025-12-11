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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";
import { getSampleStatusColor } from "../domain/sampleConfig";
import { toast } from "sonner";

export default function CheckInSampleModal({ open, onClose, vehicle }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);
  const queryClient = useQueryClient();

  const { data: warehouseSamples = [], isLoading } = useQuery({
    queryKey: ['warehouseSamples'],
    queryFn: async () => {
      const samples = await base44.entities.Sample.filter({
        location_type: "Warehouse",
      });
      return samples.filter(s => s.status === "Active");
    },
    enabled: open,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const result = await base44.functions.invoke('recordSampleMovement', {
        sample_ids: selectedSampleIds,
        from_location_type: "Warehouse",
        to_location_type: "Vehicle",
        to_location_reference_id: vehicle.id,
        movement_type: "Check Out to Vehicle",
        technician_id: user?.email,
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleSamples'] });
      queryClient.invalidateQueries({ queryKey: ['warehouseSamples'] });
      toast.success(`${selectedSampleIds.length} sample(s) checked into vehicle`);
      setSelectedSampleIds([]);
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to check in samples: ${error.message}`);
    },
  });

  const filteredSamples = warehouseSamples.filter(sample =>
    sample.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sample.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sample.sample_tag?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSample = (sampleId) => {
    setSelectedSampleIds(prev =>
      prev.includes(sampleId)
        ? prev.filter(id => id !== sampleId)
        : [...prev, sampleId]
    );
  };

  const toggleAll = () => {
    if (selectedSampleIds.length === filteredSamples.length) {
      setSelectedSampleIds([]);
    } else {
      setSelectedSampleIds(filteredSamples.map(s => s.id));
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedSampleIds([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Check In Samples to {vehicle.name || vehicle.registration}</DialogTitle>
          <DialogDescription>
            Select samples from warehouse to check into this vehicle
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search samples..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sample List */}
          <div className="flex-1 overflow-y-auto border border-[#E5E7EB] rounded-lg">
            {isLoading && (
              <div className="text-center py-8 text-[#6B7280]">
                Loading samples...
              </div>
            )}

            {!isLoading && filteredSamples.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
                <p className="text-[14px] text-[#6B7280]">
                  {searchTerm ? "No samples found" : "No samples available in warehouse"}
                </p>
              </div>
            )}

            {!isLoading && filteredSamples.length > 0 && (
              <div className="divide-y divide-[#E5E7EB]">
                {/* Select All */}
                <div className="p-3 bg-[#F9FAFB] flex items-center gap-3">
                  <Checkbox
                    checked={selectedSampleIds.length === filteredSamples.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-[13px] font-medium text-[#6B7280]">
                    Select All ({filteredSamples.length})
                  </span>
                </div>

                {filteredSamples.map((sample) => (
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
                        </div>
                        {sample.category && (
                          <p className="text-[12px] text-[#6B7280]">
                            {sample.category}
                          </p>
                        )}
                        {sample.sample_tag && (
                          <p className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">
                            Tag: {sample.sample_tag}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
            <div className="text-[13px] text-[#6B7280]">
              {selectedSampleIds.length} sample(s) selected
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                onClick={() => checkInMutation.mutate()}
                disabled={selectedSampleIds.length === 0 || checkInMutation.isPending}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                Check In {selectedSampleIds.length > 0 && `(${selectedSampleIds.length})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}