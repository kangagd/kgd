import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, isSameDay, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const colorPalette = [
  "bg-blue-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-red-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-pink-500",
];

const getJobTypeColor = (jobTypeName, allJobTypes) => {
  if (!jobTypeName) return "bg-slate-500";
  const index = allJobTypes.indexOf(jobTypeName);
  return colorPalette[index % colorPalette.length] || "bg-slate-500";
};

export default function DayCalendar({ jobs, currentDate, onDateChange, onSelectJob }) {
  const dayJobs = jobs
    .filter(job => job.scheduled_date && isSameDay(new Date(job.scheduled_date), currentDate))
    .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));

  const uniqueJobTypes = [...new Set(jobs.map(job => job.job_type_name).filter(Boolean))].sort();

  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(subDays(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(addDays(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {dayJobs.length} {dayJobs.length === 1 ? 'Job' : 'Jobs'} Scheduled
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dayJobs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No jobs scheduled for this day
            </div>
          ) : (
            <div className="space-y-3">
              {dayJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job)}
                  className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getJobTypeColor(job.job_type_name, uniqueJobTypes)}`} />
                        <span className="font-semibold text-slate-900">
                          {job.scheduled_time ? format(new Date(`2000-01-01T${job.scheduled_time}`), 'h:mm a') : 'No time set'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg text-slate-900 mb-1">
                        {job.customer_name}
                      </h3>
                      <p className="text-sm text-slate-600 mb-1">{job.address}</p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {job.job_type_name && (
                          <span className="text-slate-600">
                            <span className="font-medium">Type:</span> {job.job_type_name}
                          </span>
                        )}
                        {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                          <span className="text-slate-600">
                            <span className="font-medium">Tech:</span> {job.assigned_to_name.join(", ")}
                          </span>
                        )}
                        {job.expected_duration && (
                          <span className="text-slate-600">
                            <span className="font-medium">Duration:</span> {job.expected_duration}h
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">#{job.job_number}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="font-semibold text-slate-700">Job Types:</span>
        {uniqueJobTypes.map((jobType) => (
          <div key={jobType} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${getJobTypeColor(jobType, uniqueJobTypes)}`} />
            <span className="text-slate-600">{jobType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}