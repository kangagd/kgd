import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalendarIcon, Briefcase, ExternalLink } from "lucide-react";
import { format, addDays, subDays, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import JobDetails from "../components/jobs/JobDetails";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

const statusColors = {
  Open: "default",
  Scheduled: "primary",
  Completed: "success",
  Cancelled: "error"
};

const productColors = {
  "Garage Door": "bg-blue-100 text-blue-800",
  "Gate": "bg-green-100 text-green-800",
  "Roller Shutter": "bg-purple-100 text-purple-800",
  "Multiple": "bg-orange-100 text-orange-800",
  "Custom Garage Door": "bg-indigo-100 text-indigo-800"
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

// Job Card Component
const JobCard = ({ job, onClick, onAddressClick, onProjectClick }) => (
  <Card
    onClick={onClick}
    className="p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#E5E7EB] rounded-xl bg-white"
  >
    {/* Top Row: Time + Status */}
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm font-semibold text-[#111827]">
        {job.scheduled_time || 'Time TBD'}
      </div>
      <Badge variant={statusColors[job.status] || 'default'}>
        {job.status}
      </Badge>
    </div>

    {/* Middle Section: Job Info */}
    <div className="space-y-2 mb-3">
      <div className="flex items-start gap-2">
        <Briefcase className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#111827]">
            Job #{job.job_number}
          </div>
          <div className="text-sm text-[#4B5563]">
            {job.customer_name}
          </div>
        </div>
      </div>

      {/* Technicians */}
      {job.assigned_to_name && job.assigned_to_name.length > 0 && (
        <div className="flex items-center gap-2 ml-6">
          <div className="flex -space-x-2">
            {job.assigned_to_name.slice(0, 3).map((name, idx) => (
              <div
                key={idx}
                className={`w-6 h-6 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-xs font-semibold text-white border-2 border-white`}
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

      {/* Job Type + Product Chips */}
      <div className="flex flex-wrap gap-2 ml-6">
        {job.job_type_name && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-[#4B5563]">
            {job.job_type_name}
          </span>
        )}
        {job.product && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${productColors[job.product] || 'bg-gray-100 text-gray-800'}`}>
            {job.product}
          </span>
        )}
      </div>
    </div>

    {/* Bottom Row: Address + Project */}
    <div className="space-y-2 text-xs text-[#6B7280]">
      {job.address_full && (
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddressClick(job);
            }}
            className="text-[#2563EB] hover:underline text-left"
          >
            {job.address_full}
          </button>
        </div>
      )}
      {job.project_id && job.project_name && (
        <div className="flex items-start gap-2 ml-5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onProjectClick(job.project_id);
            }}
            className="text-[#2563EB] hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Project: {job.project_name}
          </button>
        </div>
      )}
    </div>
  </Card>
);

export default function Schedule() {
  const navigate = useNavigate();
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  // Date navigation handlers
  const handlePrevious = () => {
    if (view === "day") setSelectedDate(subDays(selectedDate, 1));
    else if (view === "week") setSelectedDate(subWeeks(selectedDate, 1));
    else setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (view === "day") setSelectedDate(addDays(selectedDate, 1));
    else if (view === "week") setSelectedDate(addWeeks(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  };

  const handleToday = () => setSelectedDate(new Date());

  // Filter jobs
  const getFilteredJobs = (dateFilter) => {
    return allJobs
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
        if (dateFilter && job.scheduled_date && !dateFilter(parseISO(job.scheduled_date))) {
          return false;
        }

        // Technician filter
        if (technicianFilter !== "all") {
          const isAssigned = Array.isArray(job.assigned_to) 
            ? job.assigned_to.includes(technicianFilter)
            : job.assigned_to === technicianFilter;
          if (!isAssigned) return false;
        }

        // Status filter
        if (statusFilter !== "all" && job.status !== statusFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.scheduled_date || '';
        const dateB = b.scheduled_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.scheduled_time || '';
        const timeB = b.scheduled_time || '';
        return timeA.localeCompare(timeB);
      });
  };

  // Get date range text
  const getDateRangeText = () => {
    if (view === "day") return format(selectedDate, 'EEEE, MMM d, yyyy');
    if (view === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(selectedDate, 'MMMM yyyy');
  };

  const handleAddressClick = (job) => {
    if (job.latitude && job.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`, '_blank');
    } else if (job.address_full) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address_full)}`, '_blank');
    }
  };

  const handleProjectClick = (projectId) => {
    navigate(`${createPageUrl("Projects")}?projectId=${projectId}`);
  };

  // Render Day View
  const renderDayView = () => {
    const dayJobs = getFilteredJobs((date) => isSameDay(date, selectedDate));
    
    if (dayJobs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#4B5563] text-center">No jobs scheduled for this day.</p>
        </div>
      );
    }

    // Group by technician
    const jobsByTech = {};
    dayJobs.forEach(job => {
      const techName = job.assigned_to_name?.[0] || 'Unassigned';
      if (!jobsByTech[techName]) jobsByTech[techName] = [];
      jobsByTech[techName].push(job);
    });

    return (
      <div className="space-y-6">
        {Object.entries(jobsByTech).map(([techName, jobs]) => (
          <div key={techName}>
            <h3 className="text-sm font-semibold text-[#4B5563] mb-3">
              Technician: {techName}
            </h3>
            <div className="space-y-3">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJob(job)}
                  onAddressClick={handleAddressClick}
                  onProjectClick={handleProjectClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="space-y-6">
        {weekDays.map(day => {
          const dayJobs = getFilteredJobs((date) => isSameDay(date, day));
          
          if (dayJobs.length === 0) return null;

          return (
            <div key={day.toISOString()}>
              <h3 className="text-base font-semibold text-[#111827] mb-3">
                {format(day, 'EEEE, MMM d')}
              </h3>
              <div className="space-y-3">
                {dayJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => setSelectedJob(job)}
                    onAddressClick={handleAddressClick}
                    onProjectClick={handleProjectClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthJobs = getFilteredJobs((date) => date >= monthStart && date <= monthEnd);

    if (monthJobs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#4B5563] text-center">No jobs scheduled for this month.</p>
        </div>
      );
    }

    // Group by date
    const jobsByDate = {};
    monthJobs.forEach(job => {
      if (job.scheduled_date) {
        const dateKey = format(parseISO(job.scheduled_date), 'yyyy-MM-dd');
        if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];
        jobsByDate[dateKey].push(job);
      }
    });

    return (
      <div className="space-y-6">
        {Object.entries(jobsByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateKey, jobs]) => (
            <div key={dateKey}>
              <h3 className="text-base font-semibold text-[#111827] mb-3">
                {format(parseISO(dateKey), 'EEEE, MMM d, yyyy')}
              </h3>
              <div className="space-y-3">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => setSelectedJob(job)}
                    onAddressClick={handleAddressClick}
                    onProjectClick={handleProjectClick}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    );
  };

  if (selectedJob) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <div className="p-4 lg:p-10 max-w-4xl mx-auto">
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

  // For mobile technicians - simple list view
  if (isTechnician) {
    const dayJobs = getFilteredJobs((date) => isSameDay(date, selectedDate));

    return (
      <div className="p-4 bg-[#ffffff] min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-[#111827] leading-tight">Schedule</h1>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white border border-[#E5E7EB] rounded-2xl p-3">
            <Button variant="outline" size="icon" onClick={handlePrevious} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <div className="text-base font-bold text-[#111827]">{format(selectedDate, 'EEEE')}</div>
              <div className="text-sm text-[#4B5563]">{format(selectedDate, 'MMM d, yyyy')}</div>
            </div>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={handleToday} className="w-full h-10 mb-4 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium rounded-xl">
            Today
          </Button>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-[#F3F4F6] rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-[#F3F4F6] rounded w-1/2"></div>
                </Card>
              ))}
            </div>
          ) : dayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
                <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
              </div>
              <p className="text-[#4B5563] text-center">No jobs scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJob(job)}
                  onAddressClick={handleAddressClick}
                  onProjectClick={handleProjectClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop/Admin view with Day/Week/Month tabs
  return (
    <div className="p-4 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Schedule</h1>
            <p className="text-sm text-[#4B5563] mt-1">{getDateRangeText()}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handlePrevious} className="h-10 w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleToday} className="h-10 px-4 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium">
              Today
            </Button>
            <Button variant="outline" onClick={handleNext} className="h-10 w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="w-full lg:w-auto">
              <TabsTrigger value="day" className="flex-1 lg:flex-initial">Day</TabsTrigger>
              <TabsTrigger value="week" className="flex-1 lg:flex-initial">Week</TabsTrigger>
              <TabsTrigger value="month" className="flex-1 lg:flex-initial">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-full lg:w-[200px] h-10 rounded-xl">
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[180px] h-10 rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-[#F3F4F6] rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-[#F3F4F6] rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {view === "day" && renderDayView()}
            {view === "week" && renderWeekView()}
            {view === "month" && renderMonthView()}
          </>
        )}
      </div>
    </div>
  );
}