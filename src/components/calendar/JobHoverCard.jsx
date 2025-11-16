import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User, FileText, CheckCircle2, Package } from "lucide-react";

const statusColors = {
  open: "bg-slate-100 text-slate-700 border-slate-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusLabels = {
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled"
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600",
  "bg-pink-600", "bg-indigo-600", "bg-red-600", "bg-teal-600",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export default function JobHoverCard({ job, position }) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <Card className="w-80 shadow-xl border-2 border-slate-300">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-lg text-slate-900">{job.customer_name}</div>
              <div className="text-xs text-slate-500">Job #{job.job_number}</div>
            </div>
            <Badge className={`${statusColors[job.status]} font-medium`}>
              {statusLabels[job.status]}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-700">{job.address}</span>
            </div>

            {job.scheduled_time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">
                  {job.scheduled_time.slice(0, 5)}
                  {job.expected_duration && ` (${job.expected_duration}h)`}
                </span>
              </div>
            )}

            {job.product && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <Badge variant="outline" className="text-xs">{job.product}</Badge>
              </div>
            )}

            {job.job_type_name && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <Badge variant="outline" className="text-xs">{job.job_type_name}</Badge>
              </div>
            )}

            {(job.assigned_to_name && job.assigned_to_name.length > 0) && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {(Array.isArray(job.assigned_to_name) ? job.assigned_to_name : [job.assigned_to_name]).slice(0, 2).map((name, idx) => (
                      <div
                        key={idx}
                        className={`${getAvatarColor(name)} w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm`}
                        title={name}
                      >
                        {getInitials(name)}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-slate-700">
                    {Array.isArray(job.assigned_to_name) ? job.assigned_to_name.join(", ") : job.assigned_to_name}
                  </span>
                </div>
              </div>
            )}

            {job.outcome && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm font-medium text-emerald-700">
                  {job.outcome.replace(/_/g, ' ')}
                </span>
              </div>
            )}

            {job.notes && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 line-clamp-3">
                    {job.notes.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}