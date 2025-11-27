import { useMemo } from 'react';
import { parseISO, isSameDay, addMinutes, format } from 'date-fns';

/**
 * Parse time string to minutes since midnight
 */
const parseTimeToMinutes = (timeString) => {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

/**
 * Check if two time ranges overlap
 */
const timeRangesOverlap = (start1, duration1, start2, duration2) => {
  if (start1 === null || start2 === null) return false;
  
  const end1 = start1 + (duration1 || 60); // Default 1 hour
  const end2 = start2 + (duration2 || 60);
  
  return start1 < end2 && start2 < end1;
};

/**
 * Check if two date ranges overlap
 */
const dateRangesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

/**
 * Find conflicting jobs for a given job at a specific date/time
 */
export const findConflicts = (job, newDate, newTime, allJobs, leaves = [], closedDays = []) => {
  const conflicts = [];
  
  const targetDateStr = typeof newDate === 'string' ? newDate : format(newDate, 'yyyy-MM-dd');
  const targetTime = newTime || job.scheduled_time || '09:00';
  const targetDurationHours = job.expected_duration || 1;
  const targetDurationMinutes = targetDurationHours * 60;
  
  // Construct start and end dates for the job
  const jobStart = new Date(`${targetDateStr}T${targetTime}`);
  const jobEnd = addMinutes(jobStart, targetDurationMinutes);
  
  const targetTimeMinutes = parseTimeToMinutes(targetTime);
  
  // Get technicians assigned to this job
  const jobTechnicians = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
  
  if (!targetDateStr) {
    return conflicts;
  }

  // 1. Check overlapping jobs
  allJobs.forEach(otherJob => {
    // Skip the same job or deleted jobs
    if (otherJob.id === job.id || otherJob.deleted_at || otherJob.status === 'Cancelled') return;
    
    // Skip jobs on different dates
    if (otherJob.scheduled_date !== targetDateStr) return;
    
    // Check if any technician overlaps
    const otherTechnicians = Array.isArray(otherJob.assigned_to) 
      ? otherJob.assigned_to 
      : otherJob.assigned_to ? [otherJob.assigned_to] : [];
    
    const hasOverlappingTechnician = jobTechnicians.some(tech => 
      otherTechnicians.includes(tech)
    );
    
    if (!hasOverlappingTechnician) return;
    
    // Check time overlap
    const otherTimeMinutes = parseTimeToMinutes(otherJob.scheduled_time);
    const otherDuration = (otherJob.expected_duration || 1) * 60;
    
    if (timeRangesOverlap(targetTimeMinutes, targetDurationMinutes, otherTimeMinutes, otherDuration)) {
      conflicts.push(otherJob);
    }
  });

  // 2. Check Technician Leave
  leaves.forEach(leave => {
    const leaveStart = new Date(leave.start_time);
    const leaveEnd = new Date(leave.end_time);

    // Check if job technicians match leave technician
    if (jobTechnicians.includes(leave.technician_email)) {
      // Check intersection
      if (dateRangesOverlap(jobStart, jobEnd, leaveStart, leaveEnd)) {
        conflicts.push({
          id: `leave-${leave.id}`,
          type: 'leave',
          leave_type: leave.leave_type,
          technician_name: leave.technician_name || leave.technician_email,
          start_time: leave.start_time,
          end_time: leave.end_time
        });
      }
    }
  });

  // 3. Check Business Closed Days
  closedDays.forEach(closed => {
    const closedStart = new Date(closed.start_time);
    const closedEnd = new Date(closed.end_time);

    if (dateRangesOverlap(jobStart, jobEnd, closedStart, closedEnd)) {
      conflicts.push({
        id: `closed-${closed.id}`,
        type: 'closed',
        name: closed.name,
        start_time: closed.start_time,
        end_time: closed.end_time
      });
    }
  });
  
  return conflicts;
};

/**
 * Hook to get conflict detection utilities
 */
export default function useScheduleConflicts(allJobs = [], leaves = [], closedDays = []) {
  const checkConflicts = useMemo(() => {
    return (job, newDate, newTime) => findConflicts(job, newDate, newTime, allJobs, leaves, closedDays);
  }, [allJobs, leaves, closedDays]);
  
  return { checkConflicts };
}