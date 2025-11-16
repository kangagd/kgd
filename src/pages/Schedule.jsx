import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import CalendarView from "../components/jobs/CalendarView";
import JobDetails from "../components/jobs/JobDetails";

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date'),
  });

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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <CalendarIcon className="w-8 h-8 text-[#fae008]" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Schedule</h1>
            <p className="text-slate-500">View and manage your schedule</p>
          </div>
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