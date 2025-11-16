import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, startOfMonth, addDays, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import DayCalendar from "../components/schedule/DayCalendar";
import WeekCalendar from "../components/schedule/WeekCalendar";
import MonthCalendar from "../components/schedule/MonthCalendar";
import JobDetailsModal from "../components/schedule/JobDetailsModal";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
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
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addMonths(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const getDateRangeText = () => {
    if (viewMode === "day") {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return `Week of ${format(weekStart, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  const handleTechnicianToggle = (techEmail) => {
    setSelectedTechnicians(prev => 
      prev.includes(techEmail)
        ? prev.filter(e => e !== techEmail)
        : [...prev, techEmail]
    );
  };

  const handleClearFilter = () => {
    setSelectedTechnicians([]);
  };

  // Filter jobs by selected technicians
  const filteredJobs = selectedTechnicians.length === 0
    ? jobs
    : jobs.filter(job => {
        const jobTechnicians = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
        return selectedTechnicians.some(techEmail => jobTechnicians.includes(techEmail));
      });

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

          <div className="flex items-center gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Technicians
                  {selectedTechnicians.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full">
                      {selectedTechnicians.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Filter by Technician</h4>
                    {selectedTechnicians.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilter}
                        className="h-auto p-1 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {technicians.map(tech => (
                      <div key={tech.email} className="flex items-center space-x-2">
                        <Checkbox
                          id={tech.email}
                          checked={selectedTechnicians.includes(tech.email)}
                          onCheckedChange={() => handleTechnicianToggle(tech.email)}
                        />
                        <Label
                          htmlFor={tech.email}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {tech.full_name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>

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

        {viewMode === "day" ? (
          <DayCalendar
            currentDate={currentDate}
            jobs={filteredJobs}
            onJobDrop={handleJobDrop}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        ) : viewMode === "week" ? (
          <WeekCalendar
            currentDate={currentDate}
            jobs={filteredJobs}
            onJobDrop={handleJobDrop}
            onJobClick={setSelectedJob}
            isLoading={isLoading}
          />
        ) : (
          <MonthCalendar
            currentDate={currentDate}
            jobs={filteredJobs}
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