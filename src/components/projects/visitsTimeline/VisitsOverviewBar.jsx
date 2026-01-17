import React from 'react';
import { Calendar, Users, Zap, CheckCircle2, AlertCircle, Camera, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const normalizeDoors = (measurements) => {
  if (!measurements) return [];
  
  // Check for new_doors array
  if (Array.isArray(measurements.new_doors) && measurements.new_doors.length > 0) {
    return measurements.new_doors;
  }
  
  // Check for single new_door object
  if (measurements.new_door) {
    return [measurements.new_door];
  }
  
  return [];
};

const getDoorSummary = (door) => {
  const parts = [];
  if (door.opening_width || door.opening_height) {
    parts.push(`${door.opening_width || '?'} × ${door.opening_height || '?'}`);
  }
  if (door.headroom) parts.push(`HR: ${door.headroom}`);
  return parts.join(', ') || 'Custom';
};

export default function VisitsOverviewBar({ visits, onSnapshotClick }) {
  if (!visits || visits.length === 0) return null;

  const latestVisit = visits[visits.length - 1];
  const latestWithMeasurements = [...visits].reverse().find(v => v.measurements);

  const doors = latestWithMeasurements ? normalizeDoors(latestWithMeasurements.measurements) : [];
  const technicianNames = latestVisit.assigned_to_name || [];
  
  // Count open next steps
  const openNextSteps = visits.reduce((sum, v) => {
    if (v.next_steps) {
      const lines = v.next_steps.split('\n').filter(l => l.trim() && !l.includes('✓'));
      return sum + lines.length;
    }
    return sum;
  }, 0);

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg p-4 bg-white">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Total Visits */}
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-[#6B7280] mb-1">Visits</span>
          <div className="text-lg font-bold text-[#111827]">{visits.length}</div>
        </div>

        {/* Last Visit Date & Tech */}
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-[#6B7280] mb-1">Last Visit</span>
          <div className="text-xs font-semibold text-[#111827]">
            {latestVisit.scheduled_date 
              ? new Date(latestVisit.scheduled_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
              : 'Not scheduled'}
          </div>
          <div className="text-xs text-[#4B5563] truncate">
            {technicianNames.length > 0 ? technicianNames[0] : 'Unassigned'}
          </div>
        </div>

        {/* Latest Outcome */}
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-[#6B7280] mb-1">Latest</span>
          <Badge variant="secondary" className="text-xs">
            {latestVisit.job_type_name || 'Visit'}
          </Badge>
        </div>

        {/* Open Next Steps */}
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-[#6B7280] mb-1">Next Steps</span>
          <div className="text-lg font-bold text-[#111827]">{openNextSteps}</div>
        </div>

        {/* Measurements Snapshot */}
        {latestWithMeasurements && doors.length > 0 && (
          <div className="flex flex-col items-start col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-[#6B7280] mb-1">Measured</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={onSnapshotClick}
              className="text-xs text-[#2563EB] hover:bg-[#2563EB]/10 p-0 h-auto"
            >
              {doors.length} {doors.length === 1 ? 'door' : 'doors'}
            </Button>
            <div className="text-xs text-[#6B7280] mt-0.5 truncate max-w-[100px]">
              {getDoorSummary(doors[0])}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}