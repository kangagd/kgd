import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, CheckCircle, Clock, Ruler, DoorOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { normalizeDoors } from '../utils/normalizeDoors';
import { TechnicianAvatarGroup } from '../common/TechnicianAvatar';

export default function VisitsOverviewBar({ visits, jobs }) {
  if (!visits || visits.length === 0) {
    return null;
  }

  const sortedVisits = [...visits].sort((a, b) => new Date(b.check_out_time || b.created_date) - new Date(a.check_out_time || a.created_date));
  const lastVisit = sortedVisits[0];
  const lastJob = jobs.find(job => job.id === lastVisit.job_id);

  const visitWithMeasurements = sortedVisits.find(v => {
    const job = jobs.find(j => j.id === v.job_id);
    return job?.measurements && normalizeDoors(job.measurements).length > 0;
  });

  const latestMeasurements = visitWithMeasurements ? normalizeDoors(jobs.find(j => j.id === visitWithMeasurements.job_id)?.measurements) : [];

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Visits</h3>
            <Badge variant="secondary">{visits.length}</Badge>
          </div>
          {lastVisit && (
            <div className="text-sm text-muted-foreground flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Last: {format(parseISO(lastVisit.check_out_time || lastVisit.created_date), 'MMM d, yyyy')}</span>
              </div>
              {lastVisit.technician_name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>{lastVisit.technician_name}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {latestMeasurements.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              Latest Measurements ({latestMeasurements.length} {latestMeasurements.length > 1 ? 'doors' : 'door'})
            </h4>
            <div className="flex flex-wrap gap-2">
              {latestMeasurements.map((door, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-2">
                  <DoorOpen className="w-3 h-3" />
                  <span>
                    {`Door ${index + 1}: ${door.width || '?'}mm W x ${door.height || '?'}mm H`}
                    {door.headroom && ` (${door.headroom}mm HR)`}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}