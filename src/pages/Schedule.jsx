import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WeekCalendar from "../components/schedule/WeekCalendar";
import MonthCalendar from "../components/schedule/MonthCalendar";
import JobDetailsModal from "../components/schedule/JobDetailsModal";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [selectedJob, setSelectedJob] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

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

  const handleJobDrop = (jobId, newDate) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const formattedDate = format(newDate, 'yyyy-MM-dd');
    updateJobMutation.mutate({
      id: jobId,
      data: { scheduled_date: formattedDate }
    });
  };

  const handlePrevious = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  const handleNext = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const getDateRangeText = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return `Week of ${format(weekStart, 'MMM d, yyyy')}`;
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <CalendarIcon className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Schedule</h1>
              <p className="text-slate-500">{getDateRangeText()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isTechnician && (
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
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
                onClick={handleNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {(viewMode === "week" || isTechnician) ? (
          <WeekCalendar
            currentDate={currentDate}
            jobs={jobs}
            onJobDrop={handleJobDrop}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        ) : (
          <MonthCalendar
            currentDate={currentDate}
            jobs={jobs}
            onJobDrop={handleJobDrop}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        )}

        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      </div>
    </div>
  );
}