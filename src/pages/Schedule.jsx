import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  scheduled: "bg-blue-500",
  in_progress: "bg-orange-500",
  completed: "bg-green-500",
  cancelled: "bg-slate-400",
};

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getJobsForDay = (day) => {
    return jobs.filter(job => {
      try {
        return job.scheduled_date && isSameDay(parseISO(job.scheduled_date), day);
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Schedule</h1>
              <p className="text-slate-500">Week of {format(weekStart, 'MMM d, yyyy')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayJobs = getJobsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <Card
                key={day.toISOString()}
                className={`p-4 border-none shadow-sm ${isToday ? 'ring-2 ring-orange-500' : ''}`}
              >
                <div className="mb-3">
                  <div className="text-sm font-medium text-slate-500">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? 'text-orange-600' : 'text-slate-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>

                <div className="space-y-2">
                  {dayJobs.length === 0 ? (
                    <p className="text-xs text-slate-400">No jobs</p>
                  ) : (
                    dayJobs.map((job) => (
                      <Link
                        key={job.id}
                        to={createPageUrl("Jobs") + `?id=${job.id}`}
                        className="block"
                      >
                        <div className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border-l-3"
                             style={{ borderLeftWidth: '3px', borderLeftColor: statusColors[job.status].replace('bg-', '#') }}>
                          <div className="text-sm font-medium text-slate-900 line-clamp-1">
                            {job.customer_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {job.scheduled_time || 'No time set'}
                          </div>
                          {job.job_type_name && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {job.job_type_name}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}