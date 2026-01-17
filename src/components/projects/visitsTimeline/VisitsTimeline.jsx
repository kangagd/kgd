import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import VisitsOverviewBar from './VisitsOverviewBar';
import VisitCard from './VisitCard';

export default function VisitsTimeline({ visits = [], projectId }) {
  const [focusedVisitIndex, setFocusedVisitIndex] = useState(null);

  if (!visits || visits.length === 0) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg p-6 bg-white text-center">
        <p className="text-[#6B7280] text-sm">No visits recorded yet</p>
      </Card>
    );
  }

  // Sort by scheduled_date chronologically
  const sortedVisits = [...visits].sort((a, b) => {
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
    return dateA - dateB;
  });

  const latestVisit = sortedVisits[sortedVisits.length - 1];

  return (
    <div className="space-y-4">
      {/* Overview Bar */}
      <VisitsOverviewBar 
        visits={sortedVisits}
        onSnapshotClick={() => {
          const visitWithMeasurements = [...sortedVisits].reverse().find(v => v.measurements);
          if (visitWithMeasurements) {
            const idx = sortedVisits.indexOf(visitWithMeasurements);
            setFocusedVisitIndex(idx);
          }
        }}
      />

      {/* Visit Cards */}
      <div className="space-y-3">
        {sortedVisits.map((visit, idx) => (
          <VisitCard
            key={visit.id}
            visit={visit}
            index={idx}
            isLatest={visit.id === latestVisit.id}
          />
        ))}
      </div>
    </div>
  );
}