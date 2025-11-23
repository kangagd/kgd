import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date')
  });

  const jobs = allJobs.filter(job => !job.deleted_at);

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
      <div className="bg-[#ffffff] min-h-screen">
        <div className="p-5 md:p-10 max-w-4xl mx-auto">
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
    <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Schedule</h1>
            <p className="text-sm text-[#4B5563] mt-1">{getDateRangeText()}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevious}
              className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-xl h-10 w-10 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToday}
              className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-xl h-10 px-4 text-sm"
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNext}
              className="border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold transition-all rounded-xl h-10 w-10 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mt-4 lg:mt-5">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto">
            <TabsList style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden' }}>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="chip-container w-full md:w-auto md:ml-auto"
            style={{ 
              maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)'
            }}
          >
            <div className="flex gap-2 items-center justify-end">
              {technicians.map(tech => (
                <Button
                  key={tech.email}
                  size="sm"
                  onClick={() => toggleTechnician(tech.email)}
                  className={`whitespace-nowrap ${selectedTechnicians.includes(tech.email) 
                    ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm rounded-lg h-10" 
                    : "border border-[#E5E7EB] hover:bg-[#F3F4F6] hover:border-[#D1D5DB] font-semibold rounded-lg h-10"
                  }`}
                >
                  {tech.full_name}
                </Button>
              ))}
              {selectedTechnicians.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTechnicians([])}
                  className="text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] font-semibold rounded-lg h-10 whitespace-nowrap"
                >
                  Clear
                </Button>
              )}
            </div>
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