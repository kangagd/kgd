import { useMemo } from 'react';
import { parseISO, isSameDay } from 'date-fns';

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
 * Find conflicting jobs for a given job at a specific date/time
 */
export const findConflicts = (job, newDate, newTime, allJobs) => {
  const conflicts = [];
  
  const targetDate = typeof newDate === 'string' ? newDate : newDate?.toISOString().split('T')[0];
  const targetTime = newTime || job.scheduled_time;
  const targetDuration = (job.expected_duration || 1) * 60; // Convert hours to minutes
  const targetTimeMinutes = parseTimeToMinutes(targetTime);
  
  // Get technicians assigned to this job
  const jobTechnicians = Array.isArray(job.assigned_to) ? job.assigned_to : job.assigned_to ? [job.assigned_to] : [];
  
  if (jobTechnicians.length === 0 || !targetDate) {
    return conflicts;
  }
  
  allJobs.forEach(otherJob => {
    // Skip the same job or deleted jobs
    if (otherJob.id === job.id || otherJob.deleted_at) return;
    
    // Skip jobs on different dates
    if (otherJob.scheduled_date !== targetDate) return;
    
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
    
    if (timeRangesOverlap(targetTimeMinutes, targetDuration, otherTimeMinutes, otherDuration)) {
      conflicts.push(otherJob);
    }
  });
  
  return conflicts;
};

/**
 * Hook to get conflict detection utilities
 */
export default function useScheduleConflicts(allJobs = []) {
  const checkConflicts = useMemo(() => {
    return (job, newDate, newTime) => findConflicts(job, newDate, newTime, allJobs);
  }, [allJobs]);
  
  return { checkConflicts };
}