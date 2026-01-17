import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DOMPurify from 'dompurify';

const normalizeDoors = (measurements) => {
  if (!measurements) return [];
  
  // Check for new_doors array (future format)
  if (Array.isArray(measurements.new_doors) && measurements.new_doors.length > 0) {
    return measurements.new_doors;
  }
  
  // Check for single new_door object (future format)
  if (measurements.new_door) {
    return [measurements.new_door];
  }
  
  // Check for legacy flat format (current data structure)
  // If it has measurement fields, treat the entire measurements object as a door
  const hasMeasurementFields = [
    'left_h', 'mid_h', 'right_h',
    'top_w', 'mid_w', 'bottom_w',
    'left_sideroom', 'right_sideroom', 'headroom',
    'opening_width', 'opening_height',
    'sideroom_left', 'sideroom_right',
    'type', 'material', 'additional_info'
  ].some(field => measurements[field] !== undefined && measurements[field] !== null);
  
  if (hasMeasurementFields) {
    // Map legacy flat format to door object structure
    return [{
      opening_width: measurements.mid_w || measurements.opening_width,
      opening_height: measurements.mid_h || measurements.opening_height,
      headroom: measurements.headroom,
      sideroom_left: measurements.left_sideroom || measurements.sideroom_left,
      sideroom_right: measurements.right_sideroom || measurements.sideroom_right,
      type: measurements.type,
      material: measurements.material,
      additional_info: measurements.additional_info,
      // Include the full measurements object for display
      _fullMeasurements: measurements
    }];
  }
  
  return [];
};

export default function VisitDetailView({ visit }) {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    measurements: true,
    findings: false,
    nextSteps: false,
    photos: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const doors = normalizeDoors(visit.measurements);

  return (
    <div className="space-y-3">
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
                {doors.map((door, idx) => {
                  const m = door._fullMeasurements || door;
                  return (
                    <div key={idx} className="border border-[#E5E7EB] rounded-lg p-3 bg-white">
                      <h5 className="font-medium text-[#111827] text-xs mb-2">
                        {doors.length === 1 ? 'Door' : `Door ${idx + 1}`}
                      </h5>
                      <div className="space-y-1 text-xs text-[#4B5563]">
                        {/* Multi-point measurements (legacy format) */}
                        {(m.left_h || m.mid_h || m.right_h) && (
                          <div className="font-medium text-[#111827]">Heights: L {m.left_h} / M {m.mid_h} / R {m.right_h}</div>
                        )}
                        {(m.top_w || m.mid_w || m.bottom_w) && (
                          <div className="font-medium text-[#111827]">Widths: T {m.top_w} / M {m.mid_w} / B {m.bottom_w}</div>
                        )}
                        {(m.left_sideroom || m.right_sideroom) && (
                          <div>Siderooms: L {m.left_sideroom} / R {m.right_sideroom}</div>
                        )}
                        {m.headroom && <div>Headroom: {m.headroom}</div>}
                        
                        {/* Simple measurements (normalized format) */}
                        {(m.opening_width && m.opening_width !== '0' && !m.mid_w) || (m.opening_height && m.opening_height !== '0' && !m.mid_h) ? (
                          <div>Opening: {m.opening_width && m.opening_width !== '0' ? m.opening_width : '?'} × {m.opening_height && m.opening_height !== '0' ? m.opening_height : '?'}</div>
                        ) : null}
                        {m.sideroom_left && m.sideroom_left !== '0' && <div>Sideroom (L): {m.sideroom_left}</div>}
                        {m.sideroom_right && m.sideroom_right !== '0' && <div>Sideroom (R): {m.sideroom_right}</div>}
                        {m.backroom && m.backroom !== '0' && <div>Backroom: {m.backroom}</div>}
                        {m.type && <div>Type: {m.type}</div>}
                        {m.material && <div>Material: {m.material}</div>}
                        {m.existing_door_removal && (
                          <div className="text-[#D97706]">⚠️ Existing door removal required</div>
                        )}
                        {m.additional_info && (
                          <div className="italic text-[#6B7280]">{m.additional_info}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
    </div>
  );
}