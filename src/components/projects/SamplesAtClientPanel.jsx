import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { getSampleStatusColor } from "../domain/sampleConfig";
import ScheduleSampleDropOffModal from "./ScheduleSampleDropOffModal";
import ScheduleSamplePickupModal from "./ScheduleSamplePickupModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function SamplesAtClientPanel({ project }) {
  const [showDropOffModal, setShowDropOffModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: clientSamples = [], isLoading } = useQuery({
    queryKey: ['clientSamples', project.id],
    queryFn: async () => {
      const samples = await base44.entities.Sample.filter({
        location_type: "With Client",
        location_reference_id: project.id,
      });
      return samples;
    },
  });

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className="border border-[#E5E7EB] shadow-sm">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="border-b border-[#E5E7EB] bg-white px-5 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[18px] font-semibold text-[#111827] flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Samples at this Client
                  {clientSamples.length > 0 && (
                    <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                      {clientSamples.length}
                    </Badge>
                  )}
                  <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ml-auto ${isExpanded ? 'transform rotate-180' : ''}`} />
                </CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t border-[#E5E7EB] bg-white px-5 py-3">
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => setShowDropOffModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowDown className="w-4 h-4" />
                  Schedule Drop-Off
                </Button>
                <Button
                  onClick={() => setShowPickupModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={clientSamples.length === 0}
                >
                  <ArrowUp className="w-4 h-4" />
                  Schedule Pickup
                </Button>
              </div>
            </div>

            <CardContent className="p-5">
          {isLoading && (
            <div className="text-center py-8 text-[#6B7280]">
              Loading samples...
            </div>
          )}

          {!isLoading && clientSamples.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No samples logged</p>
            </div>
          )}

          {!isLoading && clientSamples.length > 0 && (
            <div className="space-y-2">
              {clientSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                >
                  <div>
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
                    {sample.sample_tag && (
                      <p className="text-[11px] text-[#9CA3AF] font-mono">
                        Tag: {sample.sample_tag}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <ScheduleSampleDropOffModal
        open={showDropOffModal}
        onClose={() => setShowDropOffModal(false)}
        project={project}
      />

      <ScheduleSamplePickupModal
        open={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        project={project}
        clientSamples={clientSamples}
      />
    </>
  );
}