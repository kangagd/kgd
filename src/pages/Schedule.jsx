import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import CalendarView from "../components/jobs/CalendarView";
import JobDetails from "../components/jobs/JobDetails";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

  const jobs = allJobs.filter(job => !job.deleted_at);

  if (selectedJob) {
    return (
      <div className="bg-[#F8F9FA] min-h-screen">
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
    <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#111827] tracking-tight mb-2.5">Schedule</h1>
          <p className="text-[#4B5563]">View and manage your schedule</p>
        </div>

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