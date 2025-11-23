import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import CalendarView from "../components/jobs/CalendarView";
import JobDetails from "../components/jobs/JobDetails";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [user, setUser] = useState(null);

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