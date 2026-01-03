import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function UpcomingVisitsCard({ jobs = [], onScheduleVisit }) {
  const navigate = useNavigate();

  // Get upcoming scheduled jobs (max 2)
  const upcomingJobs = jobs
    .filter(j => j.status === "Scheduled" && j.scheduled_date)
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 2);

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[16px] font-semibold text-[#111827]">Upcoming Visits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingJobs.length === 0 ? (
          <div className="text-center py-4 text-[14px] text-[#9CA3AF]">
            No upcoming visits scheduled
          </div>
        ) : (
          <>
            {upcomingJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                className="w-full pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0 text-left hover:bg-[#F9FAFB] rounded-lg p-2 -m-2 transition-colors"
              >
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
              </button>
            ))}
          </>
        )}

        {/* Schedule Visit Button */}
        <Button
          onClick={onScheduleVisit}
          variant="outline"
          size="sm"
          className="w-full text-[13px] h-8 mt-3"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Schedule Visit
        </Button>
      </CardContent>
    </Card>
  );
}