import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function UpcomingVisitsCard({ jobs = [] }) {
  // Get upcoming scheduled jobs
  const upcomingJobs = jobs
    .filter(j => j.status === "Scheduled" && j.scheduled_date)
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 3);

  if (upcomingJobs.length === 0) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Upcoming Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-[14px] text-[#9CA3AF]">
            No upcoming visits scheduled
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Upcoming Visits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingJobs.map((job) => (
          <div key={job.id} className="pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium text-[14px] text-[#111827]">
                {job.job_type_name || `Job #${job.job_number}`}
              </div>
              <Badge variant="outline" className="text-[11px]">
                {format(new Date(job.scheduled_date), 'MMM d')}
              </Badge>
            </div>
            {job.assigned_to_name && job.assigned_to_name.length > 0 && (
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-1">
                <User className="w-3.5 h-3.5" />
                <span>{job.assigned_to_name.join(", ")}</span>
              </div>
            )}
            {job.scheduled_time && (
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{job.scheduled_time}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}