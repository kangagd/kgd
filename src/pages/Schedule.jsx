import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import JobDetails from "../components/jobs/JobDetails";
import ScheduleJobCard from "../components/schedule/ScheduleJobCard";
import DraggableJobCard from "../components/schedule/DraggableJobCard";
import RescheduleConfirmModal from "../components/schedule/RescheduleConfirmModal";
import ConflictWarningModal from "../components/schedule/ConflictWarningModal";
import useScheduleConflicts from "../components/schedule/useScheduleConflicts";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [user, setUser] = useState(null);
  
  // Drag and drop state
  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [conflictingJobs, setConflictingJobs] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notifyTechnician, setNotifyTechnician] = useState(true);

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

  const { checkConflicts } = useScheduleConflicts(allJobs);

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  
  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ jobId, newDate, newTime, notify }) => {
      const updates = {};
      if (newDate) updates.scheduled_date = typeof newDate === 'string' ? newDate : format(newDate, 'yyyy-MM-dd');
      if (newTime) updates.scheduled_time = newTime;
      
      // Update job status to Scheduled if moving to future date
      const job = allJobs.find(j => j.id === jobId);
      if (job && job.status === 'Open' && newDate) {
        const scheduledDate = new Date(newDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (scheduledDate >= today) {
          updates.status = 'Scheduled';
        }
      }
      
      await base44.entities.Job.update(jobId, updates);
      
      // Log the change
      if (user) {
        await base44.entities.ChangeHistory.create({
          job_id: jobId,
          field_name: 'rescheduled',
          old_value: `${job?.scheduled_date || 'none'} ${job?.scheduled_time || ''}`.trim(),
          new_value: `${updates.scheduled_date || job?.scheduled_date || ''} ${updates.scheduled_time || job?.scheduled_time || ''}`.trim(),
          changed_by: user.email,
          changed_by_name: user.full_name
        });
      }
      
      return { jobId, updates, notify };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      toast.success('Job rescheduled successfully');
      
      // Reset state
      setPendingReschedule(null);
      setConflictingJobs([]);
      setShowConflictModal(false);
      setShowConfirmModal(false);
    },
    onError: (error) => {
      toast.error('Failed to reschedule job');
      console.error('Reschedule error:', error);
    }
  });

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

  // Handle drag end for rescheduling
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const job = allJobs.find(j => j.id === draggableId);
    if (!job) return;
    
    // Parse destination ID to get new date/time
    // Format: "day-YYYY-MM-DD" or "day-YYYY-MM-DD-HH:MM"
    const destParts = destination.droppableId.split('-');
    let newDate = null;
    let newTime = null;
    
    if (destParts[0] === 'day' && destParts.length >= 4) {
      newDate = `${destParts[1]}-${destParts[2]}-${destParts[3]}`;
      if (destParts.length >= 6) {
        newTime = `${destParts[4]}:${destParts[5]}:00`;
      }
    }
    
    if (!newDate) return;
    
    // Check for conflicts
    const conflicts = checkConflicts(job, newDate, newTime);
    
    setPendingReschedule({ job, newDate, newTime });
    
    if (conflicts.length > 0) {
      setConflictingJobs(conflicts);
      setShowConflictModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmReschedule = () => {
    if (!pendingReschedule) return;
    
    rescheduleMutation.mutate({
      jobId: pendingReschedule.job.id,
      newDate: pendingReschedule.newDate,
      newTime: pendingReschedule.newTime,
      notify: notifyTechnician
    });
  };

  const handleConflictProceed = () => {
    setShowConflictModal(false);
    setShowConfirmModal(true);
  };

  // Render Day View with Drag and Drop
  const renderDayView = () => {
    const dayJobs = getFilteredJobs((date) => isSameDay(date, selectedDate));
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (dayJobs.length === 0) {
      return (
        <Droppable droppableId={`day-${dateStr}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex flex-col items-center justify-center py-16 rounded-xl transition-colors ${
                snapshot.isDraggingOver ? 'bg-[#FAE008]/10 border-2 border-dashed border-[#FAE008]' : ''
              }`}
            >
              <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
                <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
              </div>
              <p className="text-[#4B5563] text-center">
                {snapshot.isDraggingOver ? 'Drop job here to schedule' : 'No jobs scheduled for this day.'}
              </p>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      );
    }

    // Group by technician for display, but keep flat index for drag
    const jobsByTech = {};
    dayJobs.forEach(job => {
      const techName = job.assigned_to_name?.[0] || 'Unassigned';
      if (!jobsByTech[techName]) jobsByTech[techName] = [];
      jobsByTech[techName].push(job);
    });

    // Calculate global indices
    let globalIndex = 0;
    const jobsWithIndices = [];
    Object.entries(jobsByTech).forEach(([techName, jobs]) => {
      jobs.forEach(job => {
        jobsWithIndices.push({ job, techName, index: globalIndex++ });
      });
    });

    // Group back by tech name with global indices
    const groupedWithIndices = {};
    jobsWithIndices.forEach(item => {
      if (!groupedWithIndices[item.techName]) groupedWithIndices[item.techName] = [];
      groupedWithIndices[item.techName].push(item);
    });

    return (
      <Droppable droppableId={`day-${dateStr}`}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-6 min-h-[200px] rounded-xl p-2 -m-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-[#FAE008]/10 border-2 border-dashed border-[#FAE008]' : ''
            }`}
          >
            {Object.entries(groupedWithIndices).map(([techName, items]) => (
              <div key={techName}>
                <h3 className="text-sm font-semibold text-[#4B5563] mb-3">
                  {techName}
                </h3>
                <div className="space-y-3">
                  {items.map(({ job, index }) => (
                    <Draggable key={job.id} draggableId={job.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                        >
                          <DraggableJobCard
                            job={job}
                            onClick={() => setSelectedJob(job)}
                            onAddressClick={handleAddressClick}
                            onProjectClick={handleProjectClick}
                            isDragging={dragSnapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
              </div>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  // Render Week View with Drag and Drop
  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="space-y-6">
        {weekDays.map(day => {
          const dayJobs = getFilteredJobs((date) => isSameDay(date, day));
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, new Date());

          return (
            <Droppable key={day.toISOString()} droppableId={`day-${dateStr}`}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-xl p-3 -m-1 min-h-[80px] transition-colors ${
                    snapshot.isDraggingOver 
                      ? 'bg-[#FAE008]/10 border-2 border-dashed border-[#FAE008]' 
                      : isToday 
                        ? 'bg-blue-50/50' 
                        : ''
                  }`}
                >
                  <h3 className={`text-lg font-semibold mb-3 ${isToday ? 'text-blue-600' : 'text-[#111827]'}`}>
                    {format(day, 'EEEE, MMM d')}
                    {isToday && <span className="ml-2 text-xs font-normal text-blue-500">(Today)</span>}
                  </h3>
                  {dayJobs.length === 0 ? (
                    <p className="text-sm text-[#9CA3AF] py-4 text-center">
                      {snapshot.isDraggingOver ? 'Drop here to schedule' : 'No jobs'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dayJobs.map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                            >
                              <DraggableJobCard
                                job={job}
                                onClick={() => setSelectedJob(job)}
                                onAddressClick={handleAddressClick}
                                onProjectClick={handleProjectClick}
                                isDragging={snapshot.isDragging}
                                dragHandleProps={provided.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    );
  };

  // Render Month View with Drag and Drop
  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const monthJobs = getFilteredJobs((date) => date >= monthStart && date <= monthEnd);

    // Group by date
    const jobsByDate = {};
    monthJobs.forEach(job => {
      if (job.scheduled_date) {
        const dateKey = format(parseISO(job.scheduled_date), 'yyyy-MM-dd');
        if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];
        jobsByDate[dateKey].push(job);
      }
    });

    // Get dates with jobs + some empty dates for drop targets
    const datesWithJobs = Object.keys(jobsByDate).sort();
    
    if (datesWithJobs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#4B5563] text-center">No jobs scheduled for this month.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {datesWithJobs.map(dateKey => {
          const jobs = jobsByDate[dateKey] || [];
          const isToday = isSameDay(parseISO(dateKey), new Date());

          return (
            <Droppable key={dateKey} droppableId={`day-${dateKey}`}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-xl p-3 min-h-[80px] transition-colors ${
                    snapshot.isDraggingOver 
                      ? 'bg-[#FAE008]/10 border-2 border-dashed border-[#FAE008]' 
                      : isToday 
                        ? 'bg-blue-50/50' 
                        : ''
                  }`}
                >
                  <h3 className={`text-lg font-semibold mb-3 ${isToday ? 'text-blue-600' : 'text-[#111827]'}`}>
                    {format(parseISO(dateKey), 'EEEE, MMM d, yyyy')}
                    {isToday && <span className="ml-2 text-xs font-normal text-blue-500">(Today)</span>}
                  </h3>
                  <div className="space-y-3">
                    {jobs.map((job, index) => (
                      <Draggable key={job.id} draggableId={job.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                          >
                            <DraggableJobCard
                              job={job}
                              onClick={() => setSelectedJob(job)}
                              onAddressClick={handleAddressClick}
                              onProjectClick={handleProjectClick}
                              isDragging={snapshot.isDragging}
                              dragHandleProps={provided.dragHandleProps}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
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
                <ScheduleJobCard
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
    <div className="px-4 py-4 lg:px-6 lg:py-6 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#ffffff] z-10 pb-3 mb-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-[#111827] leading-tight">Schedule</h1>
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

          {/* View Tabs with Filters - Single row on desktop */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <Tabs value={view} onValueChange={setView}>
              <TabsList className="bg-white w-full lg:w-auto shadow-sm">
                <TabsTrigger value="day" className="flex-1 lg:flex-initial data-[state=active]:font-semibold data-[state=active]:shadow-sm">
                  Day
                </TabsTrigger>
                <TabsTrigger value="week" className="flex-1 lg:flex-initial data-[state=active]:font-semibold data-[state=active]:shadow-sm">
                  Week
                </TabsTrigger>
                <TabsTrigger value="month" className="flex-1 lg:flex-initial data-[state=active]:font-semibold data-[state=active]:shadow-sm">
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
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
            </div>
            </div>

        {/* Content */}
        <DragDropContext onDragEnd={handleDragEnd}>
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
        </DragDropContext>

        {/* Reschedule Confirmation Modal */}
        <RescheduleConfirmModal
          open={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setPendingReschedule(null);
          }}
          onConfirm={handleConfirmReschedule}
          job={pendingReschedule?.job}
          newDate={pendingReschedule?.newDate}
          newTime={pendingReschedule?.newTime}
          notifyTechnician={notifyTechnician}
          setNotifyTechnician={setNotifyTechnician}
          isSubmitting={rescheduleMutation.isPending}
        />

        {/* Conflict Warning Modal */}
        <ConflictWarningModal
          open={showConflictModal}
          onClose={() => {
            setShowConflictModal(false);
            setPendingReschedule(null);
            setConflictingJobs([]);
          }}
          onConfirm={handleConflictProceed}
          draggedJob={pendingReschedule?.job}
          conflictingJobs={conflictingJobs}
          newDate={pendingReschedule?.newDate}
          newTime={pendingReschedule?.newTime}
          isSubmitting={false}
        />
      </div>
    </div>
  );
}