import { JOB_STATUS, JOB_OUTCOME } from "@/components/domain/jobConfig";

/**
 * Determines job status based on scheduled date, outcome, and active check-in
 * Rules (in order of priority):
 * 1. If scheduled date is in future -> status = scheduled (automatic)
 * 2. If manually cancelled, keep it cancelled
 * 3. If outcome is 'completed' or 'send_invoice' -> status = completed
 * 4. Otherwise -> status = open
 */
export const determineJobStatus = (scheduledDate, outcome, hasActiveCheckIn, currentStatus = JOB_STATUS.OPEN) => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  
  // Rule 1: Future dates ALWAYS return Scheduled (highest priority, automatic)
  if (scheduled > today) {
    return JOB_STATUS.SCHEDULED;
  }
  
  // If manually cancelled, keep it Cancelled
  if (currentStatus === JOB_STATUS.CANCELLED) {
    return JOB_STATUS.CANCELLED;
  }
  
  // Rule 2: Completed outcomes
  if (outcome === JOB_OUTCOME.COMPLETED || outcome === JOB_OUTCOME.SEND_INVOICE) {
    return JOB_STATUS.COMPLETED;
  }
  
  // Rule 3: Default to Open
  return JOB_STATUS.OPEN;
};