import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import JobDetails from "../components/jobs/JobDetails";
import TechnicianScheduleList from "../components/schedule/TechnicianScheduleList";
import CalendarView from "../components/jobs/CalendarView";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("day");

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  
  const jobs = allJobs.filter(job => {
    if (!job.deleted_at) {
      // Filter by status
      const validStatuses = ["Open", "Scheduled", "In Progress"];
      if (!validStatuses.includes(job.status)) return false;

      if (isTechnician && user) {
        const isAssigned = Array.isArray(job.assigned_to) 
          ? job.assigned_to.includes(user.email)
          : job.assigned_to === user.email;
        return isAssigned;
      }
      return true;
    }
    return false;
  });

  const handlePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const getDateRangeText = () => {
    if (view === "month") return format(currentDate, 'MMMM yyyy');
    if (view === "week") return format(currentDate, 'MMM d') + ' – ' + format(addDays(currentDate, 6), 'MMM d, yyyy');
    return format(currentDate, 'EEEE, MMM d, yyyy');
  };

  if (selectedJob) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <div className={isTechnician ? "" : "p-5 md:p-10 max-w-4xl mx-auto"}>
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

  // Desktop/Admin view
  if (!isTechnician) {
    return (
      <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          <CalendarView 
            jobs={jobs}
            onSelectJob={setSelectedJob}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />
        </div>
      </div>
    );
  }

  // Mobile Technician view
  return (
    <div className="p-4 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full space-y-3">
        {/* Header with date navigation */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#111827] leading-tight">Schedule</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                className="h-8 w-8 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
                className="h-8 px-3 text-xs border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-semibold rounded-lg"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                className="h-8 w-8 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="text-sm text-[#4B5563] font-medium">
            {getDateRangeText()}
          </div>
        </div>

        <TechnicianScheduleList
          jobs={jobs}
          currentDate={currentDate}
          onJobClick={setSelectedJob}
          onDateChange={(date) => {
            setCurrentDate(date);
            setView("day");
          }}
        />
      </div>
    </div>
  );
}