import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar, ArrowDown, ArrowUp } from "lucide-react";
import { getSampleStatusColor } from "../domain/sampleConfig";
import ScheduleSampleDropOffModal from "./ScheduleSampleDropOffModal";
import ScheduleSamplePickupModal from "./ScheduleSamplePickupModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SamplesAtClientPanel({ project }) {
  const [showDropOffModal, setShowDropOffModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const navigate = useNavigate();

  const { data: clientSamples = [], isLoading: isLoadingClientSamples } = useQuery({
    queryKey: ['clientSamples', project.id],
    queryFn: () => base44.entities.Sample.filter({ checked_out_project_id: project.id }),
  });

  const { data: logisticsJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['projectLogisticsJobs', project.id],
    queryFn: () => base44.entities.Job.filter({
      project_id: project.id,
      is_logistics_job: true,
      status: { $ne: 'Cancelled' }
    }),
  });

  const sampleIdsFromJobs = React.useMemo(() => 
    logisticsJobs.flatMap(job => job.sample_ids || []), 
    [logisticsJobs]
  );

  const { data: samplesFromJobsData = [], isLoading: isLoadingSamplesFromJobs } = useQuery({
    queryKey: ['samplesFromJobs', sampleIdsFromJobs],
    queryFn: () => base44.entities.Sample.filter({ id: { $in: sampleIdsFromJobs } }),
    enabled: sampleIdsFromJobs.length > 0,
  });

  const isLoading = isLoadingClientSamples || isLoadingJobs || isLoadingSamplesFromJobs;

  const allDisplaySamples = React.useMemo(() => {
    const sampleMap = new Map();

    // Add samples already at the client
    clientSamples.forEach(s => sampleMap.set(s.id, { 
      ...s, 
      displayContext: { status: 'at_client', text: 'At Client' } 
    }));

    // Add samples from scheduled drop-off jobs
    logisticsJobs.forEach(job => {
      if (job.status !== 'Completed' && job.logistics_purpose === 'sample_dropoff') {
        (job.sample_ids || []).forEach(sampleId => {
          if (!sampleMap.has(sampleId)) {
            const sample = samplesFromJobsData.find(s => s.id === sampleId);
            if (sample) {
              sampleMap.set(sampleId, { 
                ...sample, 
                displayContext: { status: 'in_transit', text: 'Drop-off Scheduled', job } 
              });
            }
          }
        });
      }
    });

    // Enhance samples at client with pickup job info if available
    logisticsJobs.forEach(job => {
      if (job.status !== 'Completed' && job.logistics_purpose === 'sample_pickup') {
        (job.sample_ids || []).forEach(sampleId => {
          if (sampleMap.has(sampleId)) {
            const sample = sampleMap.get(sampleId);
            if (sample.displayContext.status === 'at_client') {
              sampleMap.set(sampleId, {
                ...sample,
                displayContext: { ...sample.displayContext, status: 'pickup_scheduled', text: 'Pickup Scheduled', job }
              });
            }
          }
        });
      }
    });

    return Array.from(sampleMap.values());
  }, [clientSamples, logisticsJobs, samplesFromJobsData]);

  return (
    <>
      <div className="bg-white px-5 py-3">
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

        {!isLoading && allDisplaySamples.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No samples logged</p>
          </div>
        )}

        {!isLoading && allDisplaySamples.length > 0 && (
          <div className="space-y-2">
            {allDisplaySamples.map((sample) => {
              const { displayContext } = sample;
              const relatedJob = displayContext.job;

              const badgeMap = {
                at_client: { text: 'At Client', className: 'bg-green-100 text-green-700 border-green-200' },
                in_transit: { text: 'Drop-off Scheduled', className: 'bg-blue-100 text-blue-700 border-blue-200' },
                pickup_scheduled: { text: 'Pickup Scheduled', className: 'bg-orange-100 text-orange-700 border-orange-200' }
              };
              const badgeInfo = badgeMap[displayContext.status] || { text: displayContext.text, className: 'bg-gray-100 text-gray-700 border-gray-200' };

              return (
                <div
                  key={sample.id}
                  className={`flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] transition-colors ${
                    relatedJob ? 'hover:bg-[#F9FAFB] cursor-pointer' : ''
                  }`}
                  onClick={() => relatedJob && navigate(createPageUrl("Jobs") + `?jobId=${relatedJob.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[14px] font-medium text-[#111827]">
                        {sample.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${badgeInfo.className}`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {badgeInfo.text}
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
              );
            })}
          </div>
        )}
      </CardContent>

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