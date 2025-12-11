import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowRight, Package } from "lucide-react";
import { getSampleLocationLabel } from "../domain/sampleConfig";

export default function SampleMovementHistoryModal({ open, onClose, sample }) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['sampleMovementHistory', sample?.id],
    queryFn: () => base44.entities.SampleMovement.filter(
      { sample_id: sample.id },
      '-created_date'
    ),
    enabled: open && !!sample,
  });

  if (!sample) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Movement History: {sample.name}</DialogTitle>
          <DialogDescription>
            Complete movement history for this sample
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12 text-[#6B7280]">Loading history...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
              <p className="text-[#6B7280]">No movement history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement, index) => (
                <div
                  key={movement.id}
                  className="p-4 border border-[#E5E7EB] rounded-lg bg-white hover:bg-[#F9FAFB] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {movement.movement_type}
                      </Badge>
                      {index === 0 && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <span className="text-[12px] text-[#6B7280]">
                      {format(new Date(movement.created_date), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium text-[#111827]">
                      {getSampleLocationLabel(movement.from_location_type)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span className="font-medium text-[#111827]">
                      {getSampleLocationLabel(movement.to_location_type)}
                    </span>
                  </div>

                  {movement.linked_job_id && (
                    <div className="mt-2 text-[11px] text-[#6B7280]">
                      Linked to Job: {movement.linked_job_id}
                    </div>
                  )}

                  {movement.technician_id && (
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      By: {movement.technician_id}
                    </div>
                  )}

                  {movement.notes && (
                    <div className="mt-2 text-[12px] text-[#4B5563] bg-[#F9FAFB] p-2 rounded">
                      {movement.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}