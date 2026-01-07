import React, { useState, useMemo, useCallback } from "react";
import { usePermissions } from "../components/common/PermissionsContext";
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
import { buildActiveCheckInMap } from "@/components/domain/checkInHelpers";
import { jobKeys } from "../components/api/queryKeys";

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState(false);
  const [viewType, setViewType] = useState("resource"); // 'resource' or 'calendar'
  const { user, role, isTechnician, isAdminOrManager } = usePermissions();
  
  const [viewScope, setViewScope] = useState("all");
  const [selectedTechnicianEmail, setSelectedTechnicianEmail] = useState("all");

  React.useEffect(() => {
    if (role === 'technician') {
      setViewScope('mine');
      setSelectedTechnicianEmail('me');
    }
  }, [role]);

  // When viewScope changes, update selectedTechnicianEmail accordingly
  React.useEffect(() => {
    if (viewScope === 'mine') {
      setSelectedTechnicianEmail('me');
    } else if (viewScope === 'all' && selectedTechnicianEmail === 'me') {
      setSelectedTechnicianEmail('all');
    }
  }, [viewScope]);
  
  // Drag and drop state
  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [conflictingJobs, setConflictingJobs] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notifyTechnician, setNotifyTechnician] = useState(true);
  const [modalJob, setModalJob] = useState(null);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [activeCheckInMap, setActiveCheckInMap] = useState({});
  const [todaysSectionExpanded, setTodaysSectionExpanded] = useState(isTechnician);

  // User loaded via usePermissions

  React.useEffect(() => {
    let isCancelled = false;

    async function loadActiveCheckIns() {
      try {
        const res = await base44.entities.CheckInOut.filter({
          check_out_time: null,
        });

        if (isCancelled) return;

        const records = Array.isArray(res) ? res : res?.data || [];
        const map = buildActiveCheckInMap(records);
        setActiveCheckInMap(map);
      } catch (error) {
        if (!isCancelled) {
          setActiveCheckInMap({});
        }
      }
    }

    loadActiveCheckIns();

    const interval = setInterval(loadActiveCheckIns, 5 * 60 * 1000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: jobKeys.all,
    queryFn: async () => {
      // Use backend function for robust permission handling
      const response = await base44.functions.invoke('getMyJobs');
      const jobs = response.data || [];
      // Sort manually since backend function might not sort
      return jobs.sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));
    },
  });

  // Expand jobs with scheduled_visits into separate entries for the schedule
  const expandedJobs = useMemo(() => {
    const expanded = [];
    
    allJobs.forEach(job => {
      // Add the primary visit (Visit 1)
      if (job.scheduled_date) {
        expanded.push({
          ...job,
          _isExpandedVisit: false,
          _visitIndex: 0,
          _visitId: null
        });
      }
      
      // Add additional visits
      if (job.scheduled_visits && Array.isArray(job.scheduled_visits)) {
        job.scheduled_visits.forEach((visit, index) => {
          if (visit.date) {
            expanded.push({
              ...job,
              scheduled_date: visit.date,
              scheduled_time: visit.time || job.scheduled_time,
              expected_duration: visit.duration || job.expected_duration,
              assigned_to: visit.assigned_to || job.assigned_to,
              assigned_to_name: visit.assigned_to_name || job.assigned_to_name,
              _isExpandedVisit: true,
              _visitIndex: index + 1,
              _visitId: visit.id,
              _originalVisit: visit
            });
          }
        });
      }
    });
    
    return expanded;
  }, [allJobs]);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTechnicians');
      return response.data?.technicians || [];
    }
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

  const { checkConflicts } = useScheduleConflicts(expandedJobs, leaves, closedDays);

  // Filter jobs by scope (Mine vs All)
  // Memoized to avoid re-filtering on every render
  const scopedJobs = useMemo(() => {
    if (!expandedJobs) return [];
    if (viewScope === "all") return expandedJobs;

    // Determine target email
    let targetEmail = null;
    if (selectedTechnicianEmail === "me") {
      targetEmail = user?.email;
    } else if (selectedTechnicianEmail === "all") {
      return expandedJobs;
    } else {
      targetEmail = selectedTechnicianEmail;
    }

    if (!targetEmail) return expandedJobs;

    const targetEmailLower = targetEmail.toLowerCase().trim();

    return expandedJobs.filter((job) => {
      if (!job) return false;
      const assigned = job.assigned_to; 
      
      if (Array.isArray(assigned)) {
        return assigned.some(email => email?.toLowerCase().trim() === targetEmailLower);
      }
      return assigned?.toLowerCase().trim() === targetEmailLower;
    });
  }, [expandedJobs, viewScope, user, selectedTechnicianEmail]);

  const todaysJobs = React.useMemo(() => {
    const today = new Date();
    return scopedJobs.filter(job => {
       if (!job?.scheduled_date) return false;
       try {
         return isSameDay(parseISO(job.scheduled_date), today);
       } catch { return false; }
    }).sort((a, b) => {
       const tA = a.scheduled_time || "00:00";
       const tB = b.scheduled_time || "00:00";
       return tA.localeCompare(tB);
    });
  }, [scopedJobs]);

  const handleOpenJob = useCallback((job) => {
    if (!job?.id) return;
    const url = `${createPageUrl("Jobs")}?jobId=${job.id}`;
    navigate(url);
  }, [navigate]);

  const handleOpenCheckIn = useCallback((job) => {
    if (!job?.id) return;
    const url = `${createPageUrl("CheckIn")}?jobId=${job.id}`;
    navigate(url);
  }, [navigate]);

  const renderTodaysJobs = () => (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setTodaysSectionExpanded(!todaysSectionExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
      >
        <h2 className="text-sm font-semibold text-slate-900">
          Today's Jobs
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {todaysJobs.length}
          </span>
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${todaysSectionExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {todaysSectionExpanded && (
        <div className="px-3 pb-3">
          {todaysJobs.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center italic">
              No jobs scheduled for today in this view.
            </p>
          ) : (
            <ul className="space-y-2">
              {todaysJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border border-slate-100"
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden mr-2">
                    <div className="font-semibold text-slate-900 truncate">
                      {job.job_number ? `#${job.job_number}` : ''} {job.title || "Job"}
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 truncate">
                      <span className="font-medium text-slate-700">{job.scheduled_time || "Time TBC"}</span>
                      <span>·</span>
                      <span className="truncate">{job.customer_name || job.customer?.name || "Customer"}</span>
                    </div>
                    {job.address && (
                      <div className="text-slate-500 truncate">
                        {job.address}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => handleOpenJob(job)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2 bg-[#FAE008] text-black hover:bg-[#E5CF07]"
                      onClick={() => handleOpenCheckIn(job)}
                    >
                      Check In
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
  
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
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      toast.success('Job rescheduled successfully');
      
      // Reset state
      setPendingReschedule(null);
      setConflictingJobs([]);
      setShowConflictModal(false);
      setShowConfirmModal(false);
    },
    onError: (error) => {
      toast.error('Failed to reschedule job');
    }
  });

  // Date navigation handlers
  const handlePrevious = useCallback(() => {
    if (view === "day") setSelectedDate(subDays(selectedDate, 1));
    else if (view === "week") setSelectedDate(subWeeks(selectedDate, 1));
    else setSelectedDate(subMonths(selectedDate, 1));
  }, [view, selectedDate]);

  const handleNext = useCallback(() => {
    if (view === "day") setSelectedDate(addDays(selectedDate, 1));
    else if (view === "week") setSelectedDate(addWeeks(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  }, [view, selectedDate]);

  const handleToday = useCallback(() => setSelectedDate(new Date()), []);

  // Memoize filter function to avoid recreating on every render
  const getFilteredJobs = useCallback((dateFilter) => {
    return scopedJobs
      .filter(job => {
        if (job.deleted_at) return false;
        
        // Filter out cancelled and lost jobs
        const status = job.status?.toLowerCase();
        const outcome = job.outcome?.toLowerCase();
        if (status === 'cancelled' || status === 'lost' || outcome === 'lost') return false;
        
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

        // Status filter
        if (statusFilter !== "all" && job.status !== statusFilter) {
          return false;
        }

        // Contract Filter
        if (contractFilter && !job.is_contract_job) {
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
  }, [scopedJobs, statusFilter, contractFilter]);

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

  const handleAddressClick = useCallback((job) => {
    if (job.latitude && job.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`, '_blank');
    } else if (job.address_full) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address_full)}`, '_blank');
    }
  }, []);

  const handleProjectClick = useCallback((projectId) => {
    navigate(`${createPageUrl("Projects")}?projectId=${projectId}`);
  }, [navigate]);

  const handleOpenFullJob = useCallback((job) => {
    setModalJob(null);
    navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`);
  }, [navigate]);

  // Handle drag end for rescheduling
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const job = expandedJobs.find(j => j.id === draggableId || `${j.id}-visit-${j._visitIndex}` === draggableId);
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

  const handleConfirmReschedule = (updatedTime) => {
    if (!pendingReschedule) return;
    
    rescheduleMutation.mutate({
      jobId: pendingReschedule.job.id,
      newDate: pendingReschedule.newDate,
      newTime: updatedTime !== undefined ? updatedTime : pendingReschedule.newTime,
      notify: notifyTechnician
    });
  };
  
  const handleTimeChange = (newTime) => {
    setPendingReschedule(prev => ({
      ...prev,
      newTime
    }));
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

    // Distribute jobs - if there's an active check-in, only show under checked-in technician(s)
    dayJobs.forEach(job => {
      const assignedEmails = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
      
      // Check if there are active check-ins for this job
      const activeCheckIns = activeCheckInMap[job.id]?.checkIns || [];
      const checkedInEmails = activeCheckIns.map(ci => ci.technician_email?.toLowerCase()).filter(Boolean);
      
      if (assignedEmails.length === 0) {
        // Unassigned
        jobsByTechEmail[UNASSIGNED_KEY].push(job);
      } else if (checkedInEmails.length > 0) {
        // Job has active check-ins - only show under checked-in technician(s)
        checkedInEmails.forEach((checkedInEmail) => {
          if (jobsByTechEmail[checkedInEmail] !== undefined) {
            jobsByTechEmail[checkedInEmail].push(job);
          } else {
            // Unknown technician
            if (!jobsByTechEmail[checkedInEmail]) {
              jobsByTechEmail[checkedInEmail] = [];
              const checkIn = activeCheckIns.find(ci => ci.technician_email?.toLowerCase() === checkedInEmail);
              techDisplayNames[checkedInEmail] = checkIn?.technician_name || checkedInEmail;
            }
            jobsByTechEmail[checkedInEmail].push(job);
          }
        });
      } else {
        // No active check-ins - show under all assigned technicians
        assignedEmails.forEach((rawEmail, idx) => {
          const email = rawEmail ? rawEmail.toLowerCase() : null;
          
          if (email && jobsByTechEmail[email] !== undefined) {
            // Known technician
            jobsByTechEmail[email].push(job);
          } else if (email) {
            // Unknown technician (maybe deleted or not in fetched list)
            if (!jobsByTechEmail[email]) {
              jobsByTechEmail[email] = [];
              techDisplayNames[email] = job.assigned_to_name?.[idx] || email;
            }
            jobsByTechEmail[email].push(job);
          }
        });
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

    // Get leaves for this day
    const dayLeaves = leaves.filter(leave => {
      try {
        const leaveStart = new Date(leave.start_time);
        const leaveEnd = new Date(leave.end_time);
        return selectedDate >= leaveStart && selectedDate <= leaveEnd;
      } catch {
        return false;
      }
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
            {groupsToRender.map(({ techName, items }) => {
              // Find leaves for this technician
              const techLeaves = dayLeaves.filter(leave => {
                const techEmail = technicians.find(t => (t.display_name || t.full_name) === techName)?.email;
                return techEmail && leave.technician_email.toLowerCase() === techEmail.toLowerCase();
              });

              return (
                <div key={techName}>
                  <h3 className="text-sm font-semibold text-[#4B5563] mb-3">
                    {techName}
                  </h3>
                  {techLeaves.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {techLeaves.map(leave => (
                        <div key={leave.id} className="bg-gray-200 border-l-4 border-gray-500 p-3 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700">🚫 Unavailable</span>
                            <span className="text-xs text-gray-600 capitalize px-2 py-0.5 bg-gray-300 rounded">
                              {leave.leave_type}
                            </span>
                          </div>
                          {leave.reason && (
                            <div className="text-xs text-gray-600 mt-1">{leave.reason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
                            hasActiveCheckIn={!!activeCheckInMap[job.id]}
                          />
                        </div>
                      )}
                    </Draggable>
                    ))}
                  </div>
                </div>
              );
            })}
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

          // Get leaves for this day
          const dayLeaves = leaves.filter(leave => {
            try {
              const leaveStart = new Date(leave.start_time);
              const leaveEnd = new Date(leave.end_time);
              return day >= leaveStart && day <= leaveEnd;
            } catch {
              return false;
            }
          });

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
                  {dayLeaves.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {dayLeaves.map(leave => (
                        <div key={leave.id} className="bg-gray-200 border-l-4 border-gray-500 p-2 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-700">🚫 {leave.technician_name}</span>
                            <span className="text-xs text-gray-600 capitalize px-1.5 py-0.5 bg-gray-300 rounded">
                              {leave.leave_type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {dayJobs.length === 0 ? (
                    <p className="text-sm text-[#9CA3AF] py-4 text-center">
                      {snapshot.isDraggingOver ? 'Drop here to schedule' : 'No jobs'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dayJobs.map((job, index) => {
                        const dragId = job._isExpandedVisit ? `${job.id}-visit-${job._visitIndex}` : job.id;
                        return (
                          <Draggable key={dragId} draggableId={dragId} index={index}>
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
                                  hasActiveCheckIn={!!activeCheckInMap[job.id]}
                                  visitLabel={job._isExpandedVisit ? `Visit ${job._visitIndex + 1}` : null}
                                />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
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

                   {/* Leave indicators */}
                   {leaves.filter(leave => {
                     try {
                       const leaveStart = new Date(leave.start_time);
                       const leaveEnd = new Date(leave.end_time);
                       return day >= leaveStart && day <= leaveEnd;
                     } catch {
                       return false;
                     }
                   }).map(leave => (
                     <div key={leave.id} className="text-xs p-1 mb-1 rounded bg-gray-200 border-l-2 border-gray-500 truncate">
                       🚫 {leave.technician_name?.split(' ')[0]}
                     </div>
                   ))}

                   {/* Jobs */}
                   <div className="space-y-1 overflow-y-auto max-h-[90px]">
                     {dayJobs.map((job, jobIndex) => {
                        const dragId = job._isExpandedVisit ? `${job.id}-visit-${job._visitIndex}` : job.id;
                        return (
                          <Draggable key={dragId} draggableId={dragId} index={jobIndex}>
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
                                <div className="font-medium text-[#111827] truncate flex items-center gap-1">
                                  {!!activeCheckInMap[job.id] && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                  )}
                                  {job.scheduled_time || ''} #{job.job_number}
                                  {job._isExpandedVisit && <span className="text-[#6B7280]">(V{job._visitIndex + 1})</span>}
                                </div>
                                <div className="text-[#6B7280] truncate">
                                  {job.customer_name}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
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
                      hasActiveCheckIn={!!activeCheckInMap[job.id]}
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

  // For mobile technicians - with Day/Week/Month views
  if (isTechnician) {
    const dayJobs = getFilteredJobs((date) => isSameDay(date, selectedDate));

    return (
      <div className="p-4 bg-[#ffffff] min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#111827] leading-tight">Schedule</h1>
              <p className="text-sm text-[#4B5563] mt-1">{getDateRangeText()}</p>
            </div>
            
            <div className="inline-flex w-full items-center rounded-lg border bg-white p-1 text-xs shadow-sm">
              <Button
                type="button"
                variant={viewScope === "mine" ? "default" : "ghost"}
                size="sm"
                className={`h-8 flex-1 rounded-md text-xs font-medium ${viewScope === "mine" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : "text-slate-500 hover:text-slate-900"}`}
                onClick={() => setViewScope("mine")}
              >
                My Schedule
              </Button>
              <Button
                type="button"
                variant={viewScope === "all" ? "default" : "ghost"}
                size="sm"
                className={`h-8 flex-1 rounded-md text-xs font-medium ${viewScope === "all" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : "text-slate-500 hover:text-slate-900"}`}
                onClick={() => setViewScope("all")}
              >
                All Technicians
              </Button>
            </div>
          </div>

          {/* View Tabs */}
          <Tabs value={view} onValueChange={setView} className="mb-4">
            <TabsList className="w-full bg-white shadow-sm">
              <TabsTrigger value="day" className="flex-1 data-[state=active]:font-semibold">
                Day
              </TabsTrigger>
              <TabsTrigger value="week" className="flex-1 data-[state=active]:font-semibold">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="flex-1 data-[state=active]:font-semibold">
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between mb-4 bg-white border border-[#E5E7EB] rounded-2xl p-3">
            <Button variant="outline" size="icon" onClick={handlePrevious} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <div className="text-base font-bold text-[#111827]">
                {view === "day" && format(selectedDate, 'EEEE')}
                {view === "week" && `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')}`}
                {view === "month" && format(selectedDate, 'MMMM yyyy')}
              </div>
              {view === "day" && (
                <div className="text-sm text-[#4B5563]">{format(selectedDate, 'MMM d, yyyy')}</div>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8 border-none hover:bg-[#F3F4F6]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={handleToday} className="w-full h-10 mb-4 border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium rounded-xl">
            Today
          </Button>

          {renderTodaysJobs()}

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
              {view === "day" && (
                dayJobs.length === 0 ? (
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
                )
              )}
              {view === "week" && renderTechnicianWeekView()}
              {view === "month" && renderTechnicianMonthView()}
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
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-[#111827] leading-tight">Schedule</h1>
                <p className="text-sm text-[#4B5563] mt-1">{getDateRangeText()}</p>
              </div>
              
              {isAdminOrManager && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAvailabilityManager(true)}
                    className="h-9 w-9"
                    title="Manage Availability"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAIAssistant(true)}
                    className="h-9 w-9"
                    title="AI Scheduling Assistant"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Mobile: Grid layout, Desktop: Flex row */}
            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-3 max-w-full">
              <div className="col-span-2 lg:col-span-1 flex flex-wrap items-center gap-2 max-w-full min-w-0">
                <div className="inline-flex items-center rounded-lg border bg-white p-1 text-xs shadow-sm">
                  <Button
                    type="button"
                    variant={viewScope === "mine" ? "default" : "ghost"}
                    size="sm"
                    className={`h-7 rounded-md px-3 text-xs font-medium ${viewScope === "mine" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : "text-slate-500 hover:text-slate-900"}`}
                    onClick={() => setViewScope("mine")}
                  >
                    My Schedule
                  </Button>
                  <Button
                    type="button"
                    variant={viewScope === "all" ? "default" : "ghost"}
                    size="sm"
                    className={`h-7 rounded-md px-3 text-xs font-medium ${viewScope === "all" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : "text-slate-500 hover:text-slate-900"}`}
                    onClick={() => setViewScope("all")}
                  >
                    All Technicians
                  </Button>
                </div>

                {isAdminOrManager && (
                  <>
                    <Select value={selectedTechnicianEmail} onValueChange={setSelectedTechnicianEmail} disabled={viewScope === 'mine'}>
                      <SelectTrigger className="h-9 w-[160px] text-xs border-slate-200 shadow-sm">
                        <SelectValue placeholder="Select Technician" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="me">Me</SelectItem>
                        <SelectItem value="all">All Technicians</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.email} value={tech.email}>
                            {tech.full_name || tech.display_name || tech.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-[140px] text-xs border-slate-200 shadow-sm">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              <div className="col-span-2 lg:col-span-1 flex items-center gap-2">
                <Button variant="outline" onClick={handlePrevious} className="h-10 flex-1 lg:flex-initial lg:w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={handleToday} className="h-10 flex-1 lg:flex-initial px-4 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] font-medium">
                  Today
                </Button>
                <Button variant="outline" onClick={handleNext} className="h-10 flex-1 lg:flex-initial lg:w-10 p-0 rounded-xl border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filters and Tabs Container */}
          <div className="flex flex-col gap-4 mb-6">
            {/* View Period Tabs (Day/Week/Month) */}
            <Tabs value={view} onValueChange={setView} className="w-full">
              <TabsList className="bg-white w-full">
                <TabsTrigger value="day" className="flex-1">Day</TabsTrigger>
                <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
                <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View Type Toggle (Resource/Calendar) */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E5E7EB] p-1 w-full sm:w-auto">
              <Button
                variant={viewType === "resource" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("resource")}
                className={`flex-1 sm:flex-initial ${viewType === "resource" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}`}
              >
                <LayoutList className="w-4 h-4 mr-2" />
                Resource
              </Button>
              <Button
                variant={viewType === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("calendar")}
                className={`flex-1 sm:flex-initial ${viewType === "calendar" ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""}`}
              >
                <CalendarIcon2 className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </div>
          </div>
          {renderTodaysJobs()}
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
              {view === "day" && <DayView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} leaves={leaves} />}
              {view === "week" && <WeekView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} leaves={leaves} />}
              {view === "month" && <MonthView jobs={getFilteredJobs()} currentDate={selectedDate} onJobClick={setModalJob} leaves={leaves} />}
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
          onTimeChange={handleTimeChange}
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

        <AISchedulingAssistant 
          open={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          selectedDate={selectedDate} 
          onApplySuggestion={() => queryClient.invalidateQueries({ queryKey: jobKeys.all })}
        />
      </div>
    </div>
  );
}