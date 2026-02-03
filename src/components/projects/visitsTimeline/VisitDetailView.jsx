import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DOMPurify from 'dompurify';
import { base44 } from '@/api/base44Client';
import PartsV2Panel from '@/components/v2/PartsV2Panel';
import { isPartsLogisticsV2PilotAllowed } from '@/components/utils/allowlist';
import { computeVisitReadiness } from '@/components/v2parts/readinessHelpers';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { CardHeader, CardContent } from '@/components/ui/card';

const normalizeDoors = (measurements) => {
  if (!measurements) return [];
  
  // Check for new_doors array (current format with height_left, width_mid, etc.)
  if (Array.isArray(measurements.new_doors) && measurements.new_doors.length > 0) {
    return measurements.new_doors.map(door => ({
      ...door,
      // Normalize field names for display
      height_left: door.height_left,
      height_mid: door.height_mid,
      height_right: door.height_right,
      width_top: door.width_top,
      width_mid: door.width_mid,
      width_bottom: door.width_bottom,
      sideroom_left: door.sideroom_left,
      sideroom_right: door.sideroom_right,
      type: door.type,
      finish: door.finish,
      colour: door.colour,
      additional_info: door.additional_info
    }));
  }
  
  // Check for single new_door object
  if (measurements.new_door) {
    return [measurements.new_door];
  }
  
  return [];
};

export default function VisitDetailView({ visit }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    measurements: true,
    findings: false,
    nextSteps: false,
    photos: false,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const doors = normalizeDoors(visit.measurements);

  // Fetch visit readiness (V2 pilot only)
  const { data: readiness } = useQuery({
    queryKey: ['visitReadiness', visit.id, visit.project_id],
    queryFn: () => computeVisitReadiness({ visitId: visit.id, projectId: visit.project_id }),
    enabled: isPartsLogisticsV2PilotAllowed(user) && !!visit.project_id,
    staleTime: 30000, // 30 seconds
  });

  return (
    <div className="space-y-3">
      {/* Visit Readiness (V2) - Admin Only */}
      {isPartsLogisticsV2PilotAllowed(user) && visit.project_id && readiness && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <div className="px-4 py-3">
            <h4 className="font-semibold text-[#111827] text-sm mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Visit Readiness (V2)
            </h4>
            <div className="space-y-2">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#6B7280]">Status:</span>
                <Badge 
                  variant={
                    readiness.status === 'Ready + Packed' ? 'default' : 
                    readiness.status === 'Ready (Not Packed)' ? 'secondary' : 
                    'destructive'
                  }
                  className="text-xs"
                >
                  {readiness.status === 'Ready + Packed' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {readiness.status === 'Not Ready' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {readiness.status}
                </Badge>
              </div>

              {/* Missing Blocking Count */}
              {readiness.missing_blocking > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-red-600">
                    {readiness.missing_blocking} blocking requirement{readiness.missing_blocking !== 1 ? 's' : ''} missing
                  </span>
                </div>
              )}

              {/* Packed Status */}
              {readiness.missing_blocking === 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#6B7280]">Packed:</span>
                  <span className={readiness.packed ? 'text-green-600 font-medium' : 'text-amber-600'}>
                    {readiness.packed ? 'Yes (loaded)' : 'No (not loaded)'}
                  </span>
                </div>
              )}

              {/* Loading Bay Receipts Warning */}
              {readiness.loading_bay_receipts > 0 && (
                <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                  <span className="text-amber-800">
                    {readiness.loading_bay_receipts} open receipt{readiness.loading_bay_receipts !== 1 ? 's' : ''} in loading bay for this project
                  </span>
                </div>
              )}

              {/* Missing Details */}
              {readiness.details && readiness.details.length > 0 && (
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer font-medium text-[#6B7280] hover:text-[#111827]">
                    View missing items ({readiness.details.length})
                  </summary>
                  <div className="mt-2 space-y-1 pl-3 border-l-2 border-red-200">
                    {readiness.details.map((detail, idx) => (
                      <div key={idx} className="text-red-600">
                        {detail.description || 'Unknown item'}: Need {detail.missing} more (have {detail.allocated}/{detail.required})
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Outcome & Summary */}
      <Collapsible open={expandedSections.summary} onOpenChange={() => toggleSection('summary')}>
        <Card className="border border-[#E5E7EB] rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <div className="px-4 py-3 bg-white hover:bg-[#F9FAFB] transition-colors flex items-center justify-between cursor-pointer">
              <h4 className="font-semibold text-[#111827] text-sm">Summary</h4>
              {expandedSections.summary ? (
                <ChevronUp className="w-4 h-4 text-[#6B7280]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFBFC] space-y-2">
              {visit.outcome && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#6B7280]">Outcome:</span>
                  <Badge variant="secondary" className="text-xs">
                    {visit.outcome}
                  </Badge>
                </div>
              )}
              {visit.overview && (
                <div
                  className="text-sm text-[#111827] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(visit.overview)
                  }}
                />
              )}
              {visit.completion_notes && (
                <details className="text-xs text-[#4B5563]">
                  <summary className="cursor-pointer font-medium text-[#6B7280] mb-1">Technician Notes</summary>
                  <p className="pl-3 text-xs whitespace-pre-wrap">{visit.completion_notes}</p>
                </details>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Measurements */}
      {doors.length > 0 && (
        <Collapsible open={expandedSections.measurements} onOpenChange={() => toggleSection('measurements')}>
          <Card className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="px-4 py-3 bg-white hover:bg-[#F9FAFB] transition-colors flex items-center justify-between cursor-pointer">
                <h4 className="font-semibold text-[#111827] text-sm">
                  Measurements ({doors.length} {doors.length === 1 ? 'door' : 'doors'})
                </h4>
                {expandedSections.measurements ? (
                  <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFBFC] space-y-3">
                {doors.map((door, idx) => (
                  <div key={idx} className="border border-[#E5E7EB] rounded-lg p-3 bg-white">
                    <h5 className="font-medium text-[#111827] text-xs mb-2">
                      {doors.length === 1 ? 'Door' : `Door ${idx + 1}`}
                    </h5>
                    <div className="space-y-2 text-xs text-[#4B5563]">
                      {/* Heights (left/mid/right) */}
                      {(door.height_left || door.height_mid || door.height_right) && (
                        <div className="font-medium text-[#111827]">
                          Heights: L {door.height_left || '?'} / M {door.height_mid || '?'} / R {door.height_right || '?'}mm
                        </div>
                      )}
                      
                      {/* Widths (top/mid/bottom) */}
                      {(door.width_top || door.width_mid || door.width_bottom) && (
                        <div className="font-medium text-[#111827]">
                          Widths: T {door.width_top || '?'} / M {door.width_mid || '?'} / B {door.width_bottom || '?'}mm
                        </div>
                      )}
                      
                      {/* Sideroom */}
                      {(door.sideroom_left || door.sideroom_right) && (
                        <div>Siderooms: L {door.sideroom_left || '0'} / R {door.sideroom_right || '0'}mm</div>
                      )}
                      
                      {/* Type, Finish, Colour */}
                      {door.type && <div>Type: {door.type.trim()}</div>}
                      {door.finish && <div>Finish: {door.finish.trim()}</div>}
                      {door.colour && <div>Colour: {door.colour.trim()}</div>}
                      
                      {/* Additional info */}
                      {door.additional_info && (
                        <div className="italic text-[#6B7280] whitespace-pre-wrap">{door.additional_info}</div>
                      )}
                    </div>
                  </div>
                ))}
                {visit.measurements?.notes && (
                  <div className="text-xs text-[#4B5563] italic border-t border-[#E5E7EB] pt-2">
                    {visit.measurements.notes}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Next Steps */}
      {visit.next_steps && (
        <Collapsible open={expandedSections.nextSteps} onOpenChange={() => toggleSection('nextSteps')}>
          <Card className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="px-4 py-3 bg-white hover:bg-[#F9FAFB] transition-colors flex items-center justify-between cursor-pointer">
                <h4 className="font-semibold text-[#111827] text-sm">Next Steps</h4>
                {expandedSections.nextSteps ? (
                  <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFBFC]">
                <div className="text-sm text-[#111827] whitespace-pre-wrap">{visit.next_steps}</div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Photos */}
      {visit.image_urls && visit.image_urls.length > 0 && (
        <Collapsible open={expandedSections.photos} onOpenChange={() => toggleSection('photos')}>
          <Card className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="px-4 py-3 bg-white hover:bg-[#F9FAFB] transition-colors flex items-center justify-between cursor-pointer">
                <h4 className="font-semibold text-[#111827] text-sm">
                  Photos ({visit.image_urls.length})
                </h4>
                {expandedSections.photos ? (
                  <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFBFC]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {visit.image_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={url}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-24 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Parts (V2) Section - Admin Only */}
      {isPartsLogisticsV2PilotAllowed(user) && visit.project_id && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <h4 className="font-semibold text-[#111827] text-sm">Parts (V2) — Pilot</h4>
          </CardHeader>
          <CardContent className="pt-4">
            <PartsV2Panel projectId={visit.project_id} visitId={visit.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}