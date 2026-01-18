import React, { useState } from 'react';
import { Calendar, Users, Clock, ChevronDown, ChevronUp, Camera, Package, Ruler, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import VisitDetailView from './VisitDetailView';

export default function VisitCard({ visit, index, isLatest }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const durationHours = visit.expected_duration ? `${visit.expected_duration}h` : null;
  const technicianNames = visit.assigned_to_name || [];
  const photoCount = visit.image_urls?.length || 0;
  const hasMeasurements = visit.measurements && (
    visit.measurements.new_doors?.length > 0 || 
    visit.measurements.new_door ||
    ['left_h', 'mid_h', 'right_h', 'top_w', 'mid_w', 'bottom_w', 'opening_width', 'opening_height'].some(field => visit.measurements[field])
  );
  const partsLinked = visit.linked_logistics_jobs?.length > 0 || false;

  // Check if visit is in future and not a logistics visit
  const isFuture = visit.scheduled_date && new Date(visit.scheduled_date) > new Date();
  const isLogisticsType = (visit.job_type_name || '').toLowerCase().match(/(delivery|pickup|logistics|return)/);
  const showConfirmationStatus = isFuture && !isLogisticsType;
  const isConfirmed = visit.client_confirmed_at;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`border-2 rounded-lg overflow-hidden transition-all ${
        isExpanded 
          ? 'border-[#2563EB] shadow-lg' 
          : isLatest
            ? 'border-[#FAE008] shadow-md'
            : 'border-[#E5E7EB] shadow-sm'
      }`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="bg-white px-4 py-3 cursor-pointer hover:bg-[#F9FAFB] transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Visit # and Type */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[13px] font-semibold text-[#6B7280]">Visit #{index + 1}</span>
                  <Badge variant="primary" className="text-xs">
                    {visit.job_type_name || 'Visit'}
                  </Badge>
                </div>

                {/* Date & Duration */}
                <div className="hidden sm:flex items-center gap-1 text-[#4B5563]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    {visit.scheduled_date 
                      ? new Date(visit.scheduled_date).toLocaleDateString('en-AU', { 
                          month: 'short', 
                          day: 'numeric',
                          year: visit.scheduled_date.split('-')[0] !== new Date().getFullYear().toString() ? '2-digit' : undefined
                        })
                      : 'Not scheduled'}
                  </span>
                  {durationHours && (
                    <>
                      <span className="text-xs">•</span>
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">{durationHours}</span>
                    </>
                  )}
                </div>

                {/* Technician */}
                {technicianNames.length > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-[#4B5563]">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-xs truncate">{technicianNames[0]}</span>
                  </div>
                )}
              </div>

              {/* Indicators */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasMeasurements && (
                  <Ruler className="w-4 h-4 text-[#8B5CF6]" title="Measurements recorded" />
                )}
                {photoCount > 0 && (
                  <div className="flex items-center gap-0.5 text-[#6B7280]">
                    <Camera className="w-4 h-4" />
                    <span className="text-xs">{photoCount}</span>
                  </div>
                )}
                {partsLinked && (
                  <Package className="w-4 h-4 text-[#F59E0B]" title="Parts linked" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(createPageUrl("Jobs") + `?jobId=${visit.id}`);
                  }}
                  className="h-8 w-8 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
                  title="Open job"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 py-4 border-t border-[#E5E7EB] bg-[#FAFBFC]">
            <VisitDetailView visit={visit} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}