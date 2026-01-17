import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Package, Wrench, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getNormalizedPartStatus, PART_STATUS } from "../domain/partConfig";

export default function ProjectRequirementsPanel({ job, project, projectParts = [], projectTrades = [], isLoading }) {
  if (!job.project_id) {
    return null;
  }

  const hasParts = projectParts.length > 0;
  const hasTrades = projectTrades.length > 0;
  const hasRequirements = project?.special_requirements;
  const hasAnyContent = hasParts || hasTrades || hasRequirements;

  return (
    <Collapsible defaultOpen={false}>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CollapsibleTrigger asChild>
          <CardHeader className="bg-[#F9FAFB] px-4 py-3 border-b border-[#E5E7EB] cursor-pointer hover:bg-[#F3F4F6] transition-colors group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-[14px] font-semibold text-[#6B7280] leading-[1.2]">
                  Project Requirements
                </CardTitle>
                <span className="text-[11px] text-[#9CA3AF] italic">Inherited from Project</span>
                <ChevronDown className="w-4 h-4 text-[#6B7280] transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                <span className="text-[13px] text-[#6B7280]">Loading project requirements...</span>
              </div>
            ) : !hasAnyContent ? (
              <p className="text-[13px] text-[#9CA3AF] py-2">No project requirements found.</p>
            ) : (
              <div className="space-y-4">
                {/* Parts Required */}
                {hasParts && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-[#6B7280]" />
                      <h4 className="text-[13px] font-semibold text-[#111827]">Parts ({projectParts.length})</h4>
                    </div>
                    <div className="space-y-1.5">
                      {projectParts.map((part) => {
                        const normalizedStatus = getNormalizedPartStatus(part);
                        const isReady = normalizedStatus === PART_STATUS.IN_STORAGE || 
                                       normalizedStatus === PART_STATUS.IN_VEHICLE;
                        return (
                          <div key={part.id} className={`rounded-lg border p-2 ${
                            isReady ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[13px] font-medium text-[#111827] truncate block">
                                  {part.item_name || part.category || 'Part'}
                                </span>
                                {part.quantity_required && (
                                  <span className="text-[11px] text-[#6B7280]">Qty: {part.quantity_required}</span>
                                )}
                              </div>
                              <Badge className={`text-[10px] ${
                                isReady ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {normalizedStatus || 'pending'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Third-party Trades */}
                {hasTrades && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-[#6B7280]" />
                      <h4 className="text-[13px] font-semibold text-[#111827]">Third-party Trades ({projectTrades.length})</h4>
                    </div>
                    <div className="space-y-1.5">
                      {projectTrades.map((trade) => (
                        <div key={trade.id} className="rounded-lg border border-[#E5E7EB] bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-[#111827] truncate">
                              {trade.trade_name || trade.trade_type || 'Trade'}
                            </span>
                            {trade.is_booked ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px]">Booked</Badge>
                            ) : trade.is_required ? (
                              <Badge className="bg-amber-100 text-amber-700 text-[10px]">Required</Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Requirements / Notes */}
                {hasRequirements && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-[#6B7280]" />
                      <h4 className="text-[13px] font-semibold text-[#111827]">Special Requirements</h4>
                    </div>
                    <div 
                      className="text-[13px] text-[#111827] prose prose-sm max-w-none bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]"
                      dangerouslySetInnerHTML={{ __html: project.special_requirements }}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}