import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, isSameDay, isSameMonth, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, getDay } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import JobDetails from "../components/jobs/JobDetails";
import ScheduleJobCard from "../components/schedule/ScheduleJobCard";
import DraggableJobCard from "../components/schedule/DraggableJobCard";
import RescheduleConfirmModal from "../components/schedule/RescheduleConfirmModal";
import ConflictWarningModal from "../components/schedule/ConflictWarningModal";
import useScheduleConflicts from "../components/schedule/useScheduleConflicts";
import EntityModal from "../components/common/EntityModal";
import JobModalView from "../components/jobs/JobModalView";
import AISchedulingAssistant from "../components/schedule/AISchedulingAssistant";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Sparkles, Settings } from "lucide-react";
import AvailabilityManager from "../components/schedule/AvailabilityManager";
import DayView from "../components/calendar/DayView";
import WeekView from "../components/calendar/WeekView";
import MonthView from "../components/calendar/MonthView";
import { LayoutList, Calendar as CalendarIcon2 } from "lucide-react";

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [organisationFilter, setOrganisationFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [viewType, setViewType] = useState("resource"); // 'resource' or 'calendar'
  const [user, setUser] = useState(null);
  
  // Drag and drop state
  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [conflictingJobs, setConflictingJobs] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notifyTechnician, setNotifyTechnician] = useState(true);
  const [modalJob, setModalJob] = useState(null);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);

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
    queryFn: async () => {
      // Use backend function for robust permission handling
      const response = await base44.functions.invoke('getMyJobs');
      const jobs = response.data || [];
      // Sort manually since backend function might not sort
      return jobs.sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true }),
    enabled: !!(user?.role === 'admin' || user?.role === 'manager')
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.list()
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ['technicianLeaves'],
    queryFn: () => base44.entities.TechnicianLeave.list('-start_time')
  });

  const { data: closedDays = [] } = useQuery({
    queryKey: ['businessClosedDays'],
    queryFn: () => base44.entities.BusinessClosedDay.list('-start_time')
  });

  const { data: organisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.list('name')
  });

  // Create a map of job type id to color
  const jobTypeColorMap = React.useMemo(() => {
    const map = {};
    jobTypes.forEach(jt => {
      map[jt.id] = jt.color || '#6B7280';
    });
    return map;
  }, [jobTypes]);

  const techniciansLookup = React.useMemo(() => {
    const map = {};
    technicians.forEach(t => {
      if (t.email) map[t.email.toLowerCase()] = t;
    });
    return map;
  }, [technicians]);

  const { checkConflicts } = useScheduleConflicts(allJobs, leaves, closedDays);

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
  
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
        
        // Filter out cancelled and lost jobs
        const status = job.status?.toLowerCase();
        const outcome = job.outcome?.toLowerCase();
        if (status === 'cancelled' || status === 'lost' || outcome === 'lost') return false;
        
        // Technician access filter
        if (isTechnician && user) {
          const userEmail = user.email?.toLowerCase().trim();
          const isAssigned = Array.isArray(job.assigned_to) 
            ? job.assigned_to.some(email => email?.toLowerCase().trim() === userEmail)
            : (typeof job.assigned_to === 'string' && job.assigned_to.toLowerCase().trim() === userEmail);
          if (!isAssigned) return false;
        }

        // Date filter
        if (dateFilter && job.scheduled_date) {
          try {
            const parsedDate = parseISO(job.scheduled_date);
            if (isNaN(parsedDate.getTime()) || !dateFilter(parsedDate)) {
              return false;
            }
          } catch {
            return false;
          }
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

        // Organisation Filter
        if (organisationFilter !== "all" && job.organisation_id !== organisationFilter) {
          return false;
        }

        // Job Type / Logistics Filter
        if (jobTypeFilter !== "all") {
            const isLogistics = (job.job_category === 'Logistics' || 
                                (job.job_type_name || "").match(/(Delivery|Pickup|Return)/i) ||
                                (job.job_type || "").match(/(Delivery|Pickup|Return)/i));
            
            if (jobTypeFilter === "logistics_only" && !isLogistics) return false;
            if (jobTypeFilter === "standard_only" && isLogistics) return false;
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

  const handleOpenFullJob = (job) => {
    setModalJob(null);
    navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`);
  };

  // Handle drag end for rescheduling
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const job = allJobs.find(j => j.id === draggableId);
    if (!job) return;
    
    // Parse destination ID
    // Formats: 
    // - "day-YYYY-MM-DD" (Day View)
    // - "week-EMAIL-YYYY-MM-DD" (Week View)
    const destParts = destination.droppableId.split('-');
    let newDate = null;
    let newTime = null;
    
    if (destParts[0] === 'day' && destParts.length >= 4) {
      newDate = `${destParts[1]}-${destParts[2]}-${destParts[3]}`;
    } else if (destParts[0] === 'week') {
      // week-EMAIL-YYYY-MM-DD
      // The email might contain dashes? Assuming email is safe or last parts are date
      // Actually let's parse from end
      const year = destParts[destParts.length - 3];
      const month = destParts[destParts.length - 2];
      const day = destParts[destParts.length - 1];
      newDate = `${year}-${month}-${day}`;
      
      // TODO: Handle Technician Reassignment if dropped on a different tech row
      // For now we just reschedule date
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

    // Group by technician using email to handle name changes/duplicates
    const jobsByTechEmail = {};
    const techDisplayNames = {};

    // Initialize with known technicians
    technicians.forEach(tech => {
      const email = tech.email.toLowerCase();
      jobsByTechEmail[email] = [];
      techDisplayNames[email] = tech.display_name || tech.full_name;
    });
    
    // Initialize unassigned
    const UNASSIGNED_KEY = 'unassigned';
    jobsByTechEmail[UNASSIGNED_KEY] = [];
    techDisplayNames[UNASSIGNED_KEY] = 'Unassigned';

    // Distribute jobs
    dayJobs.forEach(job => {
      const rawEmail = job.assigned_to?.[0];
      const primaryEmail = rawEmail ? rawEmail.toLowerCase() : null;
      
      if (primaryEmail && jobsByTechEmail[primaryEmail] !== undefined) {
        // Known technician
        jobsByTechEmail[primaryEmail].push(job);
      } else if (primaryEmail) {
        // Unknown technician (maybe deleted or not in fetched list)
        if (!jobsByTechEmail[primaryEmail]) {
          jobsByTechEmail[primaryEmail] = [];
          techDisplayNames[primaryEmail] = job.assigned_to_name?.[0] || primaryEmail;
        }
        jobsByTechEmail[primaryEmail].push(job);
      } else {
        // Unassigned
        jobsByTechEmail[UNASSIGNED_KEY].push(job);
      }
    });

    // Prepare render groups with global indices for drag-drop
    let globalIndex = 0;
    const groupsToRender = [];

    // Helper to add group
    const addGroup = (email, displayName) => {
      const jobs = jobsByTechEmail[email];
      if (jobs && jobs.length > 0) {
        groupsToRender.push({
          techName: displayName,
          items: jobs.map(job => ({ job, index: globalIndex++ }))
        });
      }
    };

    // 1. Add active technicians in order
    technicians.forEach(tech => {
      const email = tech.email.toLowerCase();
      addGroup(email, techDisplayNames[email]);
    });

    // 2. Add other groups (unknown techs and unassigned)
    Object.keys(jobsByTechEmail).forEach(email => {
      if (email === UNASSIGNED_KEY) return; // Handle last
      if (technicians.some(t => t.email.toLowerCase() === email)) return; // Already handled
      addGroup(email, techDisplayNames[email]);
    });

    // 3. Add unassigned last
    addGroup(UNASSIGNED_KEY, techDisplayNames[UNASSIGNED_KEY]);

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
            {groupsToRender.map(({ techName, items }) => (
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
                            onClick={() => setModalJob(job)}
                            onAddressClick={handleAddressClick}
                            onProjectClick={handleProjectClick}
                            isDragging={dragSnapshot.isDragging}
                            techniciansLookup={techniciansLookup}
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

  // Render Resource Week View (Timeline: Techs on Y, Days on X)
  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Group technicians
    const activeTechs = technicians.filter(t => 
      technicianFilter === 'all' || t.email === technicianFilter
    );

    return (
      <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl bg-white">
        <div className="min-w-[1000px]">
          {/* Header Row: Days */}
          <div className="grid grid-cols-[200px_repeat(7,minmax(0,1fr))] border-b border-[#E5E7EB]">
            <div className="p-3 bg-[#F9FAFB] font-semibold text-[#4B5563] sticky left-0 z-10 border-r border-[#E5E7EB] min-w-[200px]">
              Technician
            </div>
            {weekDays.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
                <div 
                  key={day.toISOString()} 
                  className={`p-3 text-center font-medium border-r border-[#E5E7EB] last:border-r-0 whitespace-nowrap ${
                    isToday ? 'bg-blue-50 text-blue-700' : 'bg-[#F9FAFB] text-[#4B5563]'
                  }`}
                >
                  {format(day, 'EEE, MMM d')}
                </div>
              );
            })}
          </div>

          {/* Technician Rows */}
          {activeTechs.map(tech => {
            return (
              <div key={tech.id} className="grid grid-cols-[200px_repeat(7,minmax(0,1fr))] border-b border-[#E5E7EB] last:border-b-0">
                <div className="p-3 sticky left-0 bg-white z-10 border-r border-[#E5E7EB] flex items-center gap-2 min-w-[200px]">
                  <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-sm font-bold text-[#6B7280]">
                    {(tech.full_name || tech.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate font-medium text-[#111827]">
                    {tech.full_name || tech.email}
                  </div>
                </div>
                
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  // Filter jobs for this tech and day
                  const cellJobs = getFilteredJobs((date) => isSameDay(date, day))
                    .filter(job => {
                      if (!job.assigned_to) return false;
                      const assigned = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
                      return assigned.includes(tech.email);
                    });

                  return (
                    <Droppable key={`${tech.email}-${dateStr}`} droppableId={`week-${tech.email}-${dateStr}`}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-2 min-h-[100px] border-r border-[#E5E7EB] last:border-r-0 transition-colors ${
                            snapshot.isDraggingOver ? 'bg-[#FAE008]/10' : 'bg-white'
                          }`}
                        >
                          <div className="space-y-2">
                            {cellJobs.map((job, index) => (
                              <Draggable key={job.id} draggableId={job.id} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    onClick={() => setModalJob(job)}
                                    title={`${job.customer_name}${job.scheduled_time ? ` • ${job.scheduled_time}` : ''}`}
                                    className={`text-xs p-2 rounded border bg-white hover:border-[#FAE008] shadow-sm transition-all ${
                                      dragSnapshot.isDragging ? 'rotate-2 scale-105 z-50' : ''
                                    }`}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      borderLeft: `3px solid ${jobTypeColorMap[job.job_type_id] || '#6B7280'}`
                                    }}
                                  >
                                    <div className="font-bold truncate">{job.customer_name}</div>
                                    <div className="text-[#6B7280] truncate">{job.scheduled_time}</div>
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
          })}
          
          {/* Unassigned Row */}
          {technicianFilter === 'all' && (
            <div className="grid grid-cols-[200px_repeat(7,minmax(0,1fr))] border-b border-[#E5E7EB] last:border-b-0">
              <div className="p-3 sticky left-0 bg-white z-10 border-r border-[#E5E7EB] flex items-center gap-2 min-w-[200px]">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                  ?
                </div>
                <div className="truncate font-medium text-[#6B7280]">
                  Unassigned
                </div>
              </div>
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const cellJobs = getFilteredJobs((date) => isSameDay(date, day))
                  .filter(job => !job.assigned_to || job.assigned_to.length === 0);

                return (
                  <Droppable key={`unassigned-${dateStr}`} droppableId={`week-unassigned-${dateStr}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2 min-h-[100px] border-r border-[#E5E7EB] last:border-r-0 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-[#FAE008]/10' : 'bg-[#F9FAFB]/50'
                        }`}
                      >
                        <div className="space-y-2">
                          {cellJobs.map((job, index) => (
                            <Draggable key={job.id} draggableId={job.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setModalJob(job)}
                                  title={`${job.customer_name}${job.scheduled_time ? ` • ${job.scheduled_time}` : ''}`}
                                  className="text-xs p-2 rounded border bg-white hover:border-[#FAE008] shadow-sm"
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    borderLeft: `3px solid ${jobTypeColorMap[job.job_type_id] || '#6B7280'}`
                                  }}
                                >
                                  <div className="font-bold truncate">{job.customer_name}</div>
                                  <div className="text-[#6B7280] truncate">{job.scheduled_time}</div>
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
          )}
        </div>
      </div>
    );
  };

  // Render Month View as Calendar Grid with Drag and Drop
  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthJobs = getFilteredJobs((date) => date >= monthStart && date <= monthEnd);

    // Group jobs by date
    const jobsByDate = {};
    monthJobs.forEach(job => {
      if (job.scheduled_date) {
        try {
          const parsed = parseISO(job.scheduled_date);
          if (!isNaN(parsed.getTime())) {
            const dateKey = format(parsed, 'yyyy-MM-dd');
            if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];
            jobsByDate[dateKey].push(job);
          }
        } catch {
          // Skip invalid dates
        }
      }
    });

    // Calculate calendar grid
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
          {weekDayHeaders.map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-[#6B7280] bg-[#F9FAFB]">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayJobs = jobsByDate[dateStr] || [];
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, selectedDate);

            return (
              <Droppable key={dateStr} droppableId={`day-${dateStr}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[120px] border-b border-r border-[#E5E7EB] p-1.5 transition-colors ${
                      snapshot.isDraggingOver 
                        ? 'bg-[#FAE008]/20' 
                        : isToday 
                          ? 'bg-blue-50' 
                          : !isCurrentMonth 
                            ? 'bg-[#F9FAFB]' 
                            : 'bg-white'
                    } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                  >
                    {/* Date number */}
                    <div className={`text-right mb-1 ${
                      isToday 
                        ? 'text-blue-600 font-bold' 
                        : !isCurrentMonth 
                          ? 'text-[#9CA3AF]' 
                          : 'text-[#111827]'
                    }`}>
                      <span className={`text-sm ${isToday ? 'bg-blue-600 text-white rounded-full px-1.5 py-0.5' : ''}`}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Jobs */}
                    <div className="space-y-1 overflow-y-auto max-h-[90px]">
                      {dayJobs.map((job, jobIndex) => (
                        <Draggable key={job.id} draggableId={job.id} index={jobIndex}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => setModalJob(job)}
                              className={`text-xs p-1.5 rounded cursor-grab active:cursor-grabbing transition-all ${
                                dragSnapshot.isDragging 
                                  ? 'shadow-lg ring-2 ring-[#FAE008] rotate-1 opacity-90' 
                                  : 'hover:opacity-80'
                              }`}
                              style={{
                                backgroundColor: dragSnapshot.isDragging 
                                  ? '#FAE008' 
                                  : (jobTypeColorMap[job.job_type_id] ? `${jobTypeColorMap[job.job_type_id]}20` : '#F3F4F6'),
                                borderLeft: `3px solid ${jobTypeColorMap[job.job_type_id] || '#6B7280'}`
                              }}
                            >
                              <div className="font-medium text-[#111827] truncate">
                                {job.scheduled_time || ''} #{job.job_number}
                              </div>
                              <div className="text-[#6B7280] truncate">
                                {job.customer_name}
                              </div>
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

  // Render technician week view (simplified, no drag-drop)
  const renderTechnicianWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="space-y-4">
        {weekDays.map(day => {
          const dayJobs = getFilteredJobs((date) => isSameDay(date, day));
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl p-3 ${isToday ? 'bg-blue-50/50 border border-blue-200' : 'bg-white border border-[#E5E7EB]'}`}
            >
              <h3 className={`text-base font-semibold mb-3 ${isToday ? 'text-blue-600' : 'text-[#111827]'}`}>
                {format(day, 'EEEE, MMM d')}
                {isToday && <span className="ml-2 text-xs font-normal text-blue-500">(Today)</span>}
              </h3>
              {dayJobs.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] py-2">No jobs</p>
              ) : (
                <div className="space-y-2">
                  {dayJobs.map(job => (
                    <ScheduleJobCard
                      key={job.id}
                      job={job}
                      onClick={() => setSelectedJob(job)}
                      onAddressClick={handleAddressClick}
                      onProjectClick={handleProjectClick}
                      techniciansLookup={techniciansLookup}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render technician month view (simplified calendar)
  const renderTechnicianMonthView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthJobs = getFilteredJobs((date) => date >= monthStart && date <= monthEnd);

    // Group jobs by date
    const jobsByDate = {};
    monthJobs.forEach(job => {
      if (job.scheduled_date) {
        try {
          const parsed = parseISO(job.scheduled_date);
          if (!isNaN(parsed.getTime())) {
            const dateKey = format(parsed, 'yyyy-MM-dd');
            if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];
            jobsByDate[dateKey].push(job);
          }
        } catch {
          // Skip invalid dates
        }
      }
    });

    // Calculate calendar grid
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weekDayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
          {weekDayHeaders.map((day, idx) => (
            <div key={idx} className="p-2 text-center text-xs font-semibold text-[#6B7280] bg-[#F9FAFB]">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayJobs = jobsByDate[dateStr] || [];
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, selectedDate);

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setSelectedDate(day);
                  setView("day");
                }}
                className={`min-h-[70px] border-b border-r border-[#E5E7EB] p-1 cursor-pointer hover:bg-[#FFFEF5] transition-colors ${
                  isToday ? 'bg-blue-50' : !isCurrentMonth ? 'bg-[#F9FAFB]' : 'bg-white'
                } ${index % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {/* Date number */}
                <div className={`text-right mb-1 ${
                  isToday ? 'text-blue-600 font-bold' : !isCurrentMonth ? 'text-[#9CA3AF]' : 'text-[#111827]'
                }`}>
                  <span className={`text-xs ${isToday ? 'bg-blue-600 text-white rounded-full px-1.5 py-0.5' : ''}`}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Job count indicator */}
                {dayJobs.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {dayJobs.slice(0, 2).map((job) => (
                      <div
                        key={job.id}
                        className="text-[10px] bg-[#FAE008]/30 text-[#111827] px-1 py-0.5 rounded truncate"
                      >
                        {job.scheduled_time || ''} #{job.job_number}
                      </div>
                    ))}
                    {dayJobs.length > 2 && (
                      <div className="text-[10px] text-[#6B7280] px-1">
                        +{dayJobs.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // For mobile technicians - Only Day View
  if (isTechnician) {
    const dayJobs = getFilteredJobs((date) => isSameDay(date, selectedDate));

    return (
      <div className="p-4 bg-[#ffffff] min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-[#111827] leading-tight">My Schedule</h1>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white border border-[#E5E7EB] rounded-2xl p-3">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <div className="text-base font-bold text-[#111827]">
                {format(selectedDate, 'EEEE')}
              </div>
              <div className="text-sm text-[#4B5563]">{format(selectedDate, 'MMM d, yyyy')}</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
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
          ) : (
            <>
              {dayJobs.length === 0 ? (
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
                      techniciansLookup={techniciansLookup}
                    />
                  ))}
                </div>
              )}
            </>
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
              {isAdminOrManager && (
                <Button
                  variant="outline"
                  onClick={() => setShowAvailabilityManager(true)}
                  className="h-10 px-3 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                  title="Manage Availability"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
              <AISchedulingAssistant 
                selectedDate={selectedDate} 
                onApplySuggestion={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
              />
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

          {/* Filters and Tabs Container */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
            {/* View Period Tabs (Day/Week/Month) */}
            <Tabs value={view} onValueChange={setView} className="w-full lg:w-auto">
              <TabsList className="bg-white w-full lg:w-auto">
                <TabsTrigger value="day" className="flex-1 lg:flex-initial">Day</TabsTrigger>
                <TabsTrigger value="week" className="flex-1 lg:flex-initial">Week</TabsTrigger>
                <TabsTrigger value="month" className="flex-1 lg:flex-initial">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 flex-1">
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="w-full lg:w-[200px]">
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
                <SelectTrigger className="w-full lg:w-[180px]">
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

              <Select value={organisationFilter} onValueChange={setOrganisationFilter}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="Organisation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organisations</SelectItem>
                  {organisations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Types</SelectItem>
                  <SelectItem value="standard_only">Standard Jobs</SelectItem>
                  <SelectItem value="logistics_only">Logistics Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Type Toggle (Resource/Calendar) */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E5E7EB] p-1">
              <Button
                variant={viewType === "resource" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("resource")}
                className={viewType === "resource" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                Resource
              </Button>
              <Button
                variant={viewType === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("calendar")}
                className={viewType === "calendar" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}
              >
                <CalendarIcon2 className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </div>
          </div>
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
          viewType === 'resource' ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {view === "day" && renderDayView()}
              {view === "week" && renderWeekView()}
              {view === "month" && renderMonthView()}
            </DragDropContext>
          ) : (
            <>
              {view === "day" && <DayView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} />}
              {view === "week" && <WeekView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} />}
              {view === "month" && <MonthView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} />}
            </>
          )
        )}

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

        {/* Job Modal */}
        <EntityModal
          open={!!modalJob}
          onClose={() => setModalJob(null)}
          title={`Job #${modalJob?.job_number}`}
          onOpenFullPage={() => handleOpenFullJob(modalJob)}
          fullPageLabel="Open Full Job"
        >
          {modalJob && <JobModalView job={modalJob} />}
        </EntityModal>

        {showAvailabilityManager && (
          <AvailabilityManager
            open={showAvailabilityManager}
            onClose={() => setShowAvailabilityManager(false)}
            technicians={technicians}
          />
        )}
      </div>
    </div>
  );
}