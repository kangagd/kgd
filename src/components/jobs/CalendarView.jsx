import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors = {
  in_progress: "bg-blue-500",
  new_quote: "bg-purple-500",
  update_quote: "bg-indigo-500",
  send_invoice: "bg-orange-500",
  completed: "bg-green-500",
  return_visit_required: "bg-amber-500",
  scheduled: "bg-slate-400",
  cancelled: "bg-slate-300"
};

export default function CalendarView({ jobs, onSelectJob, currentDate, onDateChange }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay).fill(null);

  const getJobsForDay = (day) => {
    return jobs.filter(job => 
      job.scheduled_date && isSameDay(new Date(job.scheduled_date), day)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(subMonths(currentDate, 1))}
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
            onClick={() => onDateChange(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs md:text-sm font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}

            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {daysInMonth.map(day => {
              const dayJobs = getJobsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square border rounded-lg p-1 md:p-2 ${
                    isToday ? 'bg-blue-50 border-blue-300' : 'border-slate-200'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
                >
                  <div className={`text-xs md:text-sm font-medium mb-1 ${
                    isToday ? 'text-blue-600' : 'text-slate-700'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '80px' }}>
                    {dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className={`text-xs px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${statusColors[job.status]} text-white truncate`}
                        title={`${job.customer_name} - ${job.scheduled_time || 'No time'}`}
                      >
                        {job.scheduled_time && (
                          <span className="font-medium">{job.scheduled_time.slice(0, 5)} </span>
                        )}
                        <span className="hidden md:inline">{job.customer_name}</span>
                        <span className="md:hidden">#{job.job_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="font-semibold text-slate-700">Legend:</span>
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${color}`} />
            <span className="text-slate-600">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}