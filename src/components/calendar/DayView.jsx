import React from "react";
import { Button } from "@/components/ui/button";
import { isSameDay, format } from "date-fns";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TechnicianRow from "../schedule/TechnicianRow";
import JobCard from "../schedule/JobCard";



export default function DayView({ jobs, currentDate, onJobClick, onQuickBook }) {
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const dayJobs = jobs.filter(job => 
    job.scheduled_date && isSameDay(new Date(job.scheduled_date), currentDate)
  );

  // Group jobs by technician
  const jobsByTechnician = technicians.map(tech => ({
    technician: tech,
    jobs: dayJobs.filter(job => {
      const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
      return assignedTo.includes(tech.email);
    }).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
  }));

  // Unassigned jobs
  const unassignedJobs = dayJobs.filter(job => {
    const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
    return assignedTo.length === 0;
  }).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));

  return (
    <div className="space-y-4">
      {/* Unassigned Jobs */}
      {unassignedJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <TechnicianRow 
            technician={{ full_name: "Unassigned" }} 
            jobCount={unassignedJobs.length}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unassignedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => onJobClick(job)}
                  showActions={true}
                />
              ))}
            </div>
          </TechnicianRow>
        </div>
      )}

      {/* Jobs by Technician */}
      {jobsByTechnician.map(({ technician, jobs: techJobs }) => {
        if (techJobs.length === 0) return null;
        
        return (
          <div key={technician.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <TechnicianRow 
              technician={technician} 
              jobCount={techJobs.length}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {techJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => onJobClick(job)}
                    showActions={true}
                  />
                ))}
              </div>
            </TechnicianRow>
          </div>
        );
      })}

      {dayJobs.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">No jobs scheduled</h3>
            <p className="text-sm text-[#4B5563]">for {format(currentDate, 'EEEE, MMMM d')}</p>
          </div>
        </div>
      )}
    </div>
  );
}