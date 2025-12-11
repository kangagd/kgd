import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";

export default function LastActivityCard({ project }) {
  if (!project.last_activity_at) {
    return null;
  }

  const timestamp = parseISO(project.last_activity_at);
  const activityType = project.last_activity_type || "Unknown Activity";
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });
  const fullDate = format(timestamp, 'MMM d, yyyy h:mm a');

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg bg-gradient-to-br from-blue-50 to-white">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          Last Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">
              Last Updated
            </div>
            <div className="text-[14px] font-semibold text-[#111827] leading-[1.4]">
              {timeAgo}
            </div>
            <div className="text-[12px] text-[#6B7280] leading-[1.35] mt-0.5">
              {fullDate}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-2 border-t border-[#E5E7EB]">
          <Activity className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5 uppercase tracking-wide">
              Activity Type
            </div>
            <div className="text-[14px] font-medium text-purple-700 leading-[1.4] bg-purple-50 px-2 py-1 rounded-md inline-block">
              {activityType}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}