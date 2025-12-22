import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function LatestVisitCard({ jobs = [] }) {
  // Get the most recently completed job
  const latestCompletedJob = jobs
    .filter(j => j.status === "Completed" && j.updated_date)
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

  if (!latestCompletedJob) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Latest Visit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-[14px] text-[#9CA3AF]">
            No completed visits yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Latest Visit</CardTitle>
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-medium text-[14px] text-[#111827] mb-1">
            {latestCompletedJob.job_type_name || `Job #${latestCompletedJob.job_number}`}
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {format(new Date(latestCompletedJob.updated_date), 'MMM d, yyyy')}
            </span>
          </div>
        </div>

        {latestCompletedJob.outcome && (
          <div className="pt-3 border-t border-[#E5E7EB]">
            <div className="text-[12px] font-medium text-[#6B7280] mb-1">Outcome</div>
            <Badge variant="outline" className="text-[11px]">
              {latestCompletedJob.outcome.replace(/_/g, ' ')}
            </Badge>
          </div>
        )}

        {latestCompletedJob.overview && (
          <div className="pt-3 border-t border-[#E5E7EB]">
            <div className="text-[12px] font-medium text-[#6B7280] mb-1">Summary</div>
            <div 
              className="text-[13px] text-[#4B5563] line-clamp-3"
              dangerouslySetInnerHTML={{ __html: latestCompletedJob.overview }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}