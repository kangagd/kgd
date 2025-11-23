import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { History, User, Calendar, Clock, MapPin, FileText, Image, DollarSign } from "lucide-react";

const activityIcons = {
  status: Calendar,
  scheduled_date: Calendar,
  scheduled_time: Clock,
  assigned_to: User,
  notes: FileText,
  image_urls: Image,
  quote_url: DollarSign,
  default: History
};

export default function JobActivityLog({ jobId }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['jobActivities', jobId],
    queryFn: async () => {
      const [changes, checkIns, summaries] = await Promise.all([
        base44.entities.ChangeHistory.filter({ job_id: jobId }, '-created_date'),
        base44.entities.CheckInOut.filter({ job_id: jobId }, '-created_date'),
        base44.entities.JobSummary.filter({ job_id: jobId }, '-created_date')
      ]);

      const activities = [
        ...changes.map(c => ({ type: 'change', ...c })),
        ...checkIns.map(c => ({ type: 'checkin', ...c })),
        ...summaries.map(s => ({ type: 'summary', ...s }))
      ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      return activities;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, idx) => {
        const Icon = activity.type === 'change' 
          ? (activityIcons[activity.field_name] || activityIcons.default)
          : activity.type === 'checkin'
          ? MapPin
          : FileText;

        return (
          <div key={idx} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-900">
                  {activity.type === 'change' && (
                    <>Changed {activity.field_name.replace(/_/g, ' ')}</>
                  )}
                  {activity.type === 'checkin' && (
                    <>{activity.check_out_time ? 'Checked out' : 'Checked in'}</>
                  )}
                  {activity.type === 'summary' && <>Completed visit</>}
                </p>
                <span className="text-xs text-gray-500">
                  {format(new Date(activity.created_date), 'MMM d, h:mm a')}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {activity.changed_by_name || activity.technician_name}
              </p>
              {activity.type === 'change' && activity.new_value && (
                <p className="text-sm text-gray-700 mt-1 truncate">
                  {activity.new_value}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}