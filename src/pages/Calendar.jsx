import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon } from "lucide-react";
import DayCalendar from "../components/calendar/DayCalendar";
import WeekCalendar from "../components/calendar/WeekCalendar";
import MonthCalendar from "../components/calendar/MonthCalendar";
import JobDetailsModal from "../components/schedule/JobDetailsModal";
import TechnicianFilter from "../components/calendar/TechnicianFilter";

export default function Calendar() {
  const [viewMode, setViewMode] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
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

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date')
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Job.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const handleJobDrop = (jobId, newDate) => {
    updateJobMutation.mutate({
      id: jobId,
      data: { scheduled_date: newDate }
    });
  };

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  // Filter jobs by selected technicians
  const filteredJobs = selectedTechnicians.length > 0
    ? jobs.filter(job => {
        if (!job.assigned_to || job.assigned_to.length === 0) return false;
        return job.assigned_to.some(tech => selectedTechnicians.includes(tech));
      })
    : jobs;

  return (
    <div className="p-2 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Calendar</h1>
            <p className="text-slate-500 mt-1 text-sm">View and manage job schedules</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {!isTechnician && (
            <TechnicianFilter
              technicians={technicians}
              selectedTechnicians={selectedTechnicians}
              onChange={setSelectedTechnicians}
            />
          )}
        </div>

        {viewMode === "day" && (
          <DayCalendar
            jobs={filteredJobs}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onSelectJob={setSelectedJob}
            onJobDrop={handleJobDrop}
          />
        )}

        {viewMode === "week" && (
          <WeekCalendar
            jobs={filteredJobs}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onJobClick={setSelectedJob}
            onJobDrop={handleJobDrop}
          />
        )}

        {viewMode === "month" && (
          <MonthCalendar
            jobs={filteredJobs}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onSelectJob={setSelectedJob}
            onJobDrop={handleJobDrop}
          />
        )}

        <JobDetailsModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      </div>
    </div>
  );
}