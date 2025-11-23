import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import JobDetails from "../components/jobs/JobDetails";
import JobList from "../components/jobs/JobList";

export default function Schedule() {
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Schedule</h1>
          <p className="text-sm text-[#4B5563] mt-1">View your scheduled jobs</p>
        </div>
        <JobList
          jobs={jobs}
          isLoading={isLoading}
          onSelectJob={setSelectedJob}
        />
      </div>
    </div>
  );
}