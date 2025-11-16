import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addMonths, isSameDay, isSameMonth, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import WeekView from "../components/schedule/WeekView";
import MonthView from "../components/schedule/MonthView";
import JobDetailsModal from "../components/schedule/JobDetailsModal";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week");
  const [selectedJob, setSelectedJob] = useState(null);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const handleJobReschedule = (jobId, newDate) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      updateJobMutation.mutate({
        id: jobId,
        data: { scheduled_date: format(newDate, 'yyyy-MM-dd') }
      });
    }
  };

  const navigateDate = (direction) => {
    if (view === "week") {
      setCurrentDate(addDays(currentDate, direction * 7));
    } else {
      setCurrentDate(addMonths(currentDate, direction));
    }
  };

  const getDateRangeText = () => {
    if (view === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Schedule</h1>
              <p className="text-slate-500">{getDateRangeText()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Tabs value={view} onValueChange={setView}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate(-1)}
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
                onClick={() => navigateDate(1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {view === "week" ? (
          <WeekView
            currentDate={currentDate}
            jobs={jobs}
            onJobReschedule={handleJobReschedule}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        ) : (
          <MonthView
            currentDate={currentDate}
            jobs={jobs}
            onJobReschedule={handleJobReschedule}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        )}

        {selectedJob && (
          <JobDetailsModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    </div>
  );
}