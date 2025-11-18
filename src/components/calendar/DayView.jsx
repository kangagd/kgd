import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isSameDay, format } from "date-fns";
import { MapPin, User, Clock, Calendar, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const statusColors = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-teal-50 text-teal-700 border-teal-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
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
    <div className="space-y-3 md:space-y-4">
      {/* Unassigned Jobs */}
      {unassignedJobs.length > 0 && (
        <div>
          <h3 className="text-xs md:text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-2 md:mb-3 px-1">
            Unassigned ({unassignedJobs.length})
          </h3>
          <div className="space-y-2 md:space-y-3">
            {unassignedJobs.map(job => (
              <Card
                key={job.id}
                className="border-2 border-[#E2E3E5] hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer"
                onClick={() => onJobClick(job)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                        <span className="text-xs md:text-sm font-bold text-[#111111]">#{job.job_number}</span>
                        <Badge className={`${statusColors[job.status] || ''} font-semibold text-xs border-2`}>
                          {job.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="font-semibold text-sm md:text-base text-[#111111] mb-1">
                        {job.customer_name}
                      </div>
                    </div>
                    {job.scheduled_time && (
                      <div className="flex items-center gap-1 text-xs md:text-sm font-bold text-[#111111] bg-[#FEF8C8] px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        {job.scheduled_time.slice(0, 5)}
                      </div>
                    )}
                  </div>
                  {job.address && (
                    <div className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm text-[#4F4F4F] mb-1.5 md:mb-2">
                      <MapPin className="w-3 h-3 md:w-4 md:h-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{job.address}</span>
                    </div>
                  )}
                  {job.job_type_name && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold text-xs border-2">
                      {job.job_type_name}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Jobs by Technician */}
      {jobsByTechnician.map(({ technician, jobs: techJobs }) => {
        if (techJobs.length === 0) return null;
        
        return (
          <div key={technician.id}>
            <div className="flex items-center gap-2 mb-2 md:mb-3 px-1">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-[#FAE008] rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-black" />
              </div>
              <h3 className="text-xs md:text-sm font-bold text-[#111111] tracking-tight">
                {technician.full_name} ({techJobs.length})
              </h3>
            </div>
            <div className="space-y-2 md:space-y-3">
              {techJobs.map(job => (
                <Card
                  key={job.id}
                  className="border-2 border-[#E2E3E5] hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onJobClick(job)}
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                          <span className="text-xs md:text-sm font-bold text-[#111111]">#{job.job_number}</span>
                          <Badge className={`${statusColors[job.status] || ''} font-semibold text-xs border-2`}>
                            {job.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="font-semibold text-sm md:text-base text-[#111111] mb-1">
                          {job.customer_name}
                        </div>
                      </div>
                      {job.scheduled_time && (
                        <div className="flex items-center gap-1 text-xs md:text-sm font-bold text-[#111111] bg-[#FEF8C8] px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time.slice(0, 5)}
                        </div>
                      )}
                    </div>
                    {job.address && (
                      <div className="flex items-start gap-1.5 md:gap-2 text-xs md:text-sm text-[#4F4F4F] mb-1.5 md:mb-2">
                        <MapPin className="w-3 h-3 md:w-4 md:h-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{job.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.job_type_name && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold text-xs border-2">
                          {job.job_type_name}
                        </Badge>
                      )}
                      {job.customer_phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${job.customer_phone}`;
                          }}
                          className="h-6 md:h-7 text-xs px-2"
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          Call
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {dayJobs.length === 0 && (
        <Card>
          <CardContent className="p-8 md:p-12 text-center">
            <Calendar className="w-10 h-10 md:w-12 md:h-12 mx-auto text-[#E2E3E5] mb-2 md:mb-3" />
            <h3 className="text-sm md:text-base font-semibold text-[#111111] mb-1">No jobs scheduled</h3>
            <p className="text-xs md:text-sm text-[#4F4F4F] mb-3 md:mb-4">No jobs found for this day</p>
            <Button
              onClick={() => onQuickBook(currentDate)}
              className="bg-[#FAE008] hover:bg-[#e5d007] text-black font-semibold"
            >
              <Clock className="w-4 h-4 mr-2" />
              Book a Job
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}