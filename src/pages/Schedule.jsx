import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalendarIcon, Briefcase } from "lucide-react";
import { format, addDays, subDays, isSameDay, parseISO } from "date-fns";
import JobDetails from "../components/jobs/JobDetails";
import { createPageUrl } from "@/utils";

const statusColors = {
  Open: "default",
  Scheduled: "primary",
  Completed: "success",
  Cancelled: "error"
};

const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-yellow-500', 'bg-indigo-500'
  ];
  const index = name?.charCodeAt(0) % colors.length || 0;
  return colors[index];
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
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

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const filteredJobs = allJobs
    .filter(job => {
      if (job.deleted_at) return false;
      
      // Technician access filter
      if (isTechnician && user) {
        const isAssigned = Array.isArray(job.assigned_to) 
          ? job.assigned_to.includes(user.email)
          : job.assigned_to === user.email;
        if (!isAssigned) return false;
      }

      // Date filter
      if (job.scheduled_date && !isSameDay(parseISO(job.scheduled_date), selectedDate)) {
        return false;
      }

      // Technician filter
      if (technicianFilter !== "all") {
        const isAssigned = Array.isArray(job.assigned_to) 
          ? job.assigned_to.includes(technicianFilter)
          : job.assigned_to === technicianFilter;
        if (!isAssigned) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const timeA = a.scheduled_time || '';
      const timeB = b.scheduled_time || '';
      return timeA.localeCompare(timeB);
    });

  const handlePrevious = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNext = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleAddressClick = (job) => {
    if (job.latitude && job.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`, '_blank');
    } else if (job.address_full) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address_full)}`, '_blank');
    }
  };

  if (selectedJob) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <div className="p-4 max-w-4xl mx-auto">
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
    <div className="p-4 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#111827] leading-tight">Schedule</h1>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-4 bg-white border border-[#E5E7EB] rounded-2xl p-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="h-8 w-8 border-none hover:bg-[#F3F4F6]"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="text-center">
            <div className="text-base font-bold text-[#111827]">
              {format(selectedDate, 'EEEE')}
            </div>
            <div className="text-sm text-[#4B5563]">
              {format(selectedDate, 'MMM d, yyyy')}
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 border-none hover:bg-[#F3F4F6]"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            onClick={handleToday}
            className="flex-1 h-10 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium rounded-xl"
          >
            Today
          </Button>

          {!isTechnician && technicians.length > 0 && (
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger className="flex-1 h-10 rounded-xl">
                <SelectValue placeholder="All Technicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.email} value={tech.email}>
                    {tech.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-[#F3F4F6] rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-[#F3F4F6] rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p className="text-[#4B5563] text-center">No jobs scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#E5E7EB] rounded-2xl"
              >
                {/* Time */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[#111827]">
                    {job.scheduled_time || 'Time TBD'}
                  </div>
                  <Badge variant={statusColors[job.status] || 'default'}>
                    {job.status}
                  </Badge>
                </div>

                {/* Job Title */}
                <div className="flex items-start gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-[#111827]">
                      Job #{job.job_number} • {job.job_type_name || job.job_type || 'Service'}
                    </div>
                    <div className="text-sm text-[#4B5563]">
                      {job.customer_name}
                    </div>
                  </div>
                </div>

                {/* Address */}
                {job.address_full && (
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddressClick(job);
                      }}
                      className="text-sm text-[#2563EB] hover:underline text-left"
                    >
                      {job.address_full}
                    </button>
                  </div>
                )}

                {/* Technicians */}
                {job.assigned_to_name && job.assigned_to_name.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {job.assigned_to_name.slice(0, 3).map((name, idx) => (
                        <div
                          key={idx}
                          className={`w-7 h-7 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-xs font-semibold text-white border-2 border-white`}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {job.assigned_to_name.slice(0, 2).join(', ')}
                      {job.assigned_to_name.length > 2 && ` +${job.assigned_to_name.length - 2}`}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}