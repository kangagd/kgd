import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TestTube2, ChevronDown } from "lucide-react";
import SamplesAtClientPanel from "./SamplesAtClientPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function PartsTab({ project }) {
  const [samplesExpanded, setSamplesExpanded] = useState(false);

  const { data: samples = [] } = useQuery({
    queryKey: ['projectSamples', project.id],
    queryFn: async () => {
      const allSamples = await base44.entities.Sample.list();
      return allSamples.filter(s => s.current_location_project_id === project.id);
    },
    enabled: !!project.id
  });

  return (
    <div className="space-y-6">
      {/* Parts management removed - placeholder */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardContent className="p-8 text-center">
          <div className="text-[14px] text-[#9CA3AF] mb-2">
            Parts management has been removed. New parts system coming soon.
          </div>
        </CardContent>
      </Card>

      {/* Samples */}
      <Collapsible open={samplesExpanded} onOpenChange={setSamplesExpanded}>
        <Card id="samples" className="border border-[#E5E7EB] shadow-sm scroll-mt-6">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[16px] font-semibold text-[#111827] flex items-center gap-2">
                  <TestTube2 className="w-5 h-5 text-[#6B7280]" />
                  Samples (Reference)
                  {samples.length > 0 && (
                    <span className="text-sm font-normal text-[#6B7280]">
                      ({samples.length})
                    </span>
                  )}
                </CardTitle>
                <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${samplesExpanded ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <SamplesAtClientPanel project={project} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}