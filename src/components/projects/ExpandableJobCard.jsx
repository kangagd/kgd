import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, User, Clock, ChevronDown, ExternalLink, ImageIcon, FileText } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const jobStatusColors = {
  "Open": "bg-slate-100 text-slate-800 border-slate-200",
  "Scheduled": "bg-blue-100 text-blue-800 border-blue-200",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const outcomeColors = {
  send_invoice: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  return_visit_required: "bg-amber-100 text-amber-800",
  stage_progression: "bg-purple-100 text-purple-800"
};

export default function ExpandableJobCard({ job, onOpenJob }) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch job summary if job is completed
  const { data: jobSummary } = useQuery({
    queryKey: ['jobSummary', job.id],
    queryFn: async () => {
      const summaries = await base44.entities.JobSummary.filter({ job_id: job.id }, '-check_out_time');
      return summaries.length > 0 ? summaries[0] : null;
    },
    enabled: isOpen && (job.status === 'Completed' || !!job.outcome),
    staleTime: 30000
  });

  const formatDuration = (minutes) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Prioritize JobSummary data over Job entity data
  const displayData = jobSummary || job;
  const hasDetailedInfo = displayData.overview || displayData.next_steps || displayData.communication_with_client || displayData.measurements || displayData.notes || displayData.completion_notes || displayData.additional_info;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all">
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 text-left">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <Badge className="bg-white text-[#6B7280] hover:bg-white border border-[#E5E7EB] font-medium text-xs px-2.5 py-0.5 rounded-lg">
                  #{job.job_number}
                </Badge>
                {job.job_type_name && (
                  <Badge className="bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#EDE9FE] border-0 font-semibold text-xs px-3 py-1 rounded-lg">
                    {job.job_type_name}
                  </Badge>
                )}
                {job.status && (
                  <Badge className={`${jobStatusColors[job.status]} font-semibold text-xs px-3 py-1 rounded-lg border`}>
                    {job.status}
                  </Badge>
                )}
                {displayData.outcome && (
                  <Badge className={`${outcomeColors[displayData.outcome]} font-medium text-xs px-2.5 py-0.5 rounded-lg`}>
                    {displayData.outcome.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`w-5 h-5 text-[#6B7280] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Basic Info Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[#111827] font-medium truncate text-xs">
                    {job.assigned_to_name.join(', ')}
                  </span>
                </div>
              )}
              {job.scheduled_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[#4B5563] text-xs">
                    {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                    {job.scheduled_time && ` ${job.scheduled_time}`}
                  </span>
                </div>
              )}
              {jobSummary?.duration_minutes && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[#4B5563] font-medium text-xs">
                    {formatDuration(jobSummary.duration_minutes)}
                  </span>
                </div>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-[#E5E7EB] pt-3">
            {/* Overview */}
            {displayData.overview && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Overview</div>
                <div 
                  className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.overview }}
                />
              </div>
            )}

            {/* Next Steps */}
            {displayData.next_steps && (
              <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E5E7EB]">
                <div className="text-xs font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wide">Next Steps</div>
                <div 
                  className="text-sm text-[#111827] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.next_steps }}
                />
              </div>
            )}

            {/* Communication */}
            {displayData.communication_with_client && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Client Communication</div>
                <div 
                  className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.communication_with_client }}
                />
              </div>
            )}

            {/* Measurements */}
            {displayData.measurements && Object.keys(displayData.measurements).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Measurements</div>
                <div className="bg-white rounded-lg p-3 border border-[#E5E7EB] space-y-4">
                  {/* New Door Measurements */}
                  {displayData.measurements.new_door && Object.keys(displayData.measurements.new_door).some(k => displayData.measurements.new_door[k]) && (
                    <div>
                      <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">New Door</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                        {displayData.measurements.new_door.height_left && (
                          <div>
                            <span className="text-[#6B7280]">Height L:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.height_left}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.height_mid && (
                          <div>
                            <span className="text-[#6B7280]">Height M:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.height_mid}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.height_right && (
                          <div>
                            <span className="text-[#6B7280]">Height R:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.height_right}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.width_top && (
                          <div>
                            <span className="text-[#6B7280]">Width T:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.width_top}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.width_mid && (
                          <div>
                            <span className="text-[#6B7280]">Width M:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.width_mid}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.width_bottom && (
                          <div>
                            <span className="text-[#6B7280]">Width B:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.width_bottom}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.headroom && (
                          <div>
                            <span className="text-[#6B7280]">Headroom:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.headroom}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.sideroom_left && (
                          <div>
                            <span className="text-[#6B7280]">Sideroom L:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.sideroom_left}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.sideroom_right && (
                          <div>
                            <span className="text-[#6B7280]">Sideroom R:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.sideroom_right}mm</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.type && (
                          <div>
                            <span className="text-[#6B7280]">Type:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.type}</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.finish && (
                          <div>
                            <span className="text-[#6B7280]">Finish:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.finish}</span>
                          </div>
                        )}
                        {displayData.measurements.new_door.colour && (
                          <div>
                            <span className="text-[#6B7280]">Colour:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.new_door.colour}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Existing Door Measurements */}
                  {displayData.measurements.existing_door && Object.keys(displayData.measurements.existing_door).some(k => k !== 'removal_required' && displayData.measurements.existing_door[k]) && (
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">
                        Existing Door
                        {displayData.measurements.existing_door.removal_required === "Y" && 
                          <span className="ml-2 text-orange-600">(Removal Required)</span>
                        }
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                        {displayData.measurements.existing_door.height_left && (
                          <div>
                            <span className="text-[#6B7280]">Height L:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.height_left}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.height_mid && (
                          <div>
                            <span className="text-[#6B7280]">Height M:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.height_mid}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.height_right && (
                          <div>
                            <span className="text-[#6B7280]">Height R:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.height_right}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.width_top && (
                          <div>
                            <span className="text-[#6B7280]">Width T:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.width_top}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.width_mid && (
                          <div>
                            <span className="text-[#6B7280]">Width M:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.width_mid}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.width_bottom && (
                          <div>
                            <span className="text-[#6B7280]">Width B:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.width_bottom}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.width && (
                          <div>
                            <span className="text-[#6B7280]">Width:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.width}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.headroom && (
                          <div>
                            <span className="text-[#6B7280]">Headroom:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.headroom}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.sideroom_left && (
                          <div>
                            <span className="text-[#6B7280]">Sideroom L:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.sideroom_left}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.sideroom_right && (
                          <div>
                            <span className="text-[#6B7280]">Sideroom R:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.sideroom_right}mm</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.type && (
                          <div>
                            <span className="text-[#6B7280]">Type:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.type}</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.finish && (
                          <div>
                            <span className="text-[#6B7280]">Finish:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.finish}</span>
                          </div>
                        )}
                        {displayData.measurements.existing_door.colour && (
                          <div>
                            <span className="text-[#6B7280]">Colour:</span>
                            <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.existing_door.colour}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy flat measurements (backward compatibility) */}
                  {!displayData.measurements.new_door && !displayData.measurements.existing_door && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
                      {displayData.measurements.width && (
                        <div>
                          <span className="text-[#6B7280]">Width:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.width}</span>
                        </div>
                      )}
                      {displayData.measurements.height && (
                        <div>
                          <span className="text-[#6B7280]">Height:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.height}</span>
                        </div>
                      )}
                      {displayData.measurements.headroom && (
                        <div>
                          <span className="text-[#6B7280]">Headroom:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.headroom}</span>
                        </div>
                      )}
                      {displayData.measurements.sideroom_left && (
                        <div>
                          <span className="text-[#6B7280]">Sideroom L:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.sideroom_left}</span>
                        </div>
                      )}
                      {displayData.measurements.sideroom_right && (
                        <div>
                          <span className="text-[#6B7280]">Sideroom R:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.sideroom_right}</span>
                        </div>
                      )}
                      {displayData.measurements.depth && (
                        <div>
                          <span className="text-[#6B7280]">Depth:</span>
                          <span className="ml-1 font-medium text-[#111827]">{displayData.measurements.depth}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Info */}
                  {displayData.measurements.additional_info && (
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <span className="text-[#6B7280] text-[12px]">Additional Info:</span>
                      <p className="text-[13px] text-[#111827] mt-0.5">{displayData.measurements.additional_info}</p>
                    </div>
                  )}
                  {displayData.measurements.notes && (
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <span className="text-[#6B7280] text-[12px]">Notes:</span>
                      <p className="text-[13px] text-[#111827] mt-0.5">{displayData.measurements.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {displayData.notes && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Notes</div>
                <div 
                  className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.notes }}
                />
              </div>
            )}

            {/* Completion Notes */}
            {displayData.completion_notes && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Completion Notes</div>
                <div 
                  className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.completion_notes }}
                />
              </div>
            )}

            {/* Additional Info */}
            {displayData.additional_info && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[#111827]">Additional Information</div>
                <div 
                  className="text-sm text-[#4B5563] leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayData.additional_info }}
                />
              </div>
            )}

            {/* Photos indicator */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                {(displayData.photo_urls?.length > 0 || displayData.image_urls?.length > 0) && (
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    <span>{(displayData.photo_urls || displayData.image_urls || []).length} photo{(displayData.photo_urls || displayData.image_urls || []).length > 1 ? 's' : ''}</span>
                  </div>
                )}
                {displayData.measurements && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Measurements recorded</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenJob(job.id);
                }}
                className="gap-2 hover:bg-[#FAE008] hover:text-[#111827] hover:border-[#FAE008] transition-all h-8"
              >
                Open Job
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>

            {/* Checkout timestamp */}
            {jobSummary?.check_out_time && (
              <div className="text-xs text-[#9CA3AF] text-right">
                Checked out {format(new Date(jobSummary.check_out_time), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}