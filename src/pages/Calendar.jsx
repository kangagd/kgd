import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import DayView from "../components/calendar/DayView";
import WeekView from "../components/calendar/WeekView";
import MonthView from "../components/calendar/MonthView";
import JobDetails from "../components/jobs/JobDetails";

export default function Calendar() {
  const [viewMode, setViewMode] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTechnicians, setSelectedTechnicians] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date')
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const filteredJobs = jobs.filter(job => {
    if (selectedTechnicians.length === 0) return true;
    
    if (Array.isArray(job.assigned_to)) {
      return job.assigned_to.some(email => selectedTechnicians.includes(email));
    }
    
    return selectedTechnicians.includes(job.assigned_to);
  });

  const handlePrevious = () => {
    if (viewMode === "day") setCurrentDate(subDays(currentDate, 1));
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === "day") setCurrentDate(addDays(currentDate, 1));
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeText = () => {
    if (viewMode === "day") {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
    if (viewMode === "week") {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    if (viewMode === "month") {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  const toggleTechnician = (email) => {
    setSelectedTechnicians(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  if (selectedJob) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="p-2 md:p-8 max-w-4xl mx-auto">
          <JobDetails
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onEdit={() => {}}
            onStatusChange={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Calendar</h1>
            <p className="text-slate-500 text-sm mt-1">{getDateRangeText()}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-600 self-center">Filter by technician:</span>
            {technicians.map(tech => (
              <Button
                key={tech.email}
                variant={selectedTechnicians.includes(tech.email) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleTechnician(tech.email)}
                className={selectedTechnicians.includes(tech.email) ? "bg-[#fae008] text-slate-900 hover:bg-[#e5d007]" : ""}
              >
                {tech.full_name}
              </Button>
            ))}
            {selectedTechnicians.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTechnicians([])}
                className="text-slate-500"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {viewMode === "day" && (
          <DayView 
            jobs={filteredJobs} 
            currentDate={currentDate}
            onJobClick={setSelectedJob}
          />
        )}
        {viewMode === "week" && (
          <WeekView 
            jobs={filteredJobs} 
            currentDate={currentDate}
            onJobClick={setSelectedJob}
          />
        )}
        {viewMode === "month" && (
          <MonthView 
            jobs={filteredJobs} 
            currentDate={currentDate}
            onJobClick={setSelectedJob}
          />
        )}
      </div>
    </div>
  );
}