import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProjectSnapshotZone({ project, parts = [], jobs = [] }) {
  // Determine blockers
  const blockers = [];

  // Check for parts not yet arrived
  const partsNotArrived = parts.filter(p => {
    const status = (p.status || '').toLowerCase().replace(/\s+/g, '_');
    return !['in_storage', 'in_vehicle', 'installed', 'cancelled'].includes(status);
  });

  if (partsNotArrived.length > 0) {
    blockers.push(`${partsNotArrived.length} part${partsNotArrived.length > 1 ? 's' : ''} not yet arrived`);
  }

  // Check for unscheduled jobs
  const unscheduledJobs = jobs.filter(j => j.status === "Open" && !j.scheduled_date);
  if (unscheduledJobs.length > 0) {
    blockers.push(`${unscheduledJobs.length} visit${unscheduledJobs.length > 1 ? 's' : ''} not yet scheduled`);
  }

  // Check project-level blockers from notes/description
  const descriptionLower = (project.description || '').toLowerCase();
  const notesLower = (project.notes || '').toLowerCase();
  const combinedText = descriptionLower + ' ' + notesLower;

  if (combinedText.includes('waiting on') || combinedText.includes('blocked by') || combinedText.includes('pending approval')) {
    // Extract blocker text if possible
    const waitingMatch = (project.description || project.notes || '').match(/waiting on[^.!?\n]*/i);
    if (waitingMatch) {
      blockers.push(waitingMatch[0].trim());
    }
  }

  // Determine overall status
  let status = 'Ready';
  let statusIcon = CheckCircle;
  let statusColor = 'bg-green-100 text-green-700';

  if (blockers.length > 0) {
    status = 'Blocked';
    statusIcon = AlertCircle;
    statusColor = 'bg-red-100 text-red-700';
  } else if (partsNotArrived.length === 0 && jobs.some(j => j.status === "Open")) {
    status = 'Partial';
    statusIcon = Clock;
    statusColor = 'bg-amber-100 text-amber-700';
  }

  const StatusIcon = statusIcon;

  // If no blockers, hide the entire zone
  if (blockers.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-red-200 bg-red-50/50 shadow-sm rounded-lg overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${status === 'Ready' ? 'text-green-600' : status === 'Blocked' ? 'text-red-600' : 'text-amber-600'}`} />
          <h3 className="text-[16px] font-semibold text-[#111827]">Project Status</h3>
          <Badge className={`${statusColor} font-semibold`}>
            {status}
          </Badge>
        </div>

        {blockers.length > 0 && (
          <div>
            <div className="text-[13px] font-medium text-red-700 mb-2">Blockers:</div>
            <ul className="space-y-1.5">
              {blockers.map((blocker, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[14px] text-red-800">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}