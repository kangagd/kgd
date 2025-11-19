import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { isSameDay, format } from "date-fns";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TechnicianRow from "../schedule/TechnicianRow";
import JobCard from "../schedule/JobCard";

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColors = [
  "bg-[#FAE008]", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-indigo-500", "bg-red-500", "bg-teal-500",
];

const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};



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
        <Card className="card-enhanced overflow-hidden">
          <div className="bg-[#F8F9FA] border-b-2 border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">?</span>
                </div>
                <span className="font-bold text-[#111827] text-base">Unassigned</span>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 rounded-lg px-2 py-1 font-semibold border-2 text-xs">{unassignedJobs.length} Jobs</Badge>
            </div>
          </div>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      )}

      {/* Jobs by Technician */}
      {jobsByTechnician.map(({ technician, jobs: techJobs }) => {
        if (techJobs.length === 0) return null;

        return (
          <Card key={technician.id} className="card-enhanced overflow-hidden">
            <div className="bg-[#F8F9FA] border-b-2 border-[#E5E7EB] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${getAvatarColor(technician.full_name)} w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-sm border-2 border-black`}>
                    {getInitials(technician.full_name)}
                  </div>
                  <span className="font-bold text-[#111827] text-base">{technician.full_name}</span>
                </div>
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 rounded-lg px-2 py-1 font-semibold border-2 text-xs">{techJobs.length} Jobs</Badge>
              </div>
            </div>
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        );
      })}

      {dayJobs.length === 0 && (
        <Card className="card-enhanced">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-[#F8F9FA] rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-[#111827] mb-2">No jobs scheduled</h3>
              <p className="text-sm text-[#4B5563]">for {format(currentDate, 'EEEE, MMMM d')}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}