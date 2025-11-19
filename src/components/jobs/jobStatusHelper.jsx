/**
 * Determines job status based on scheduled date and outcome
 * Rules (in order of priority):
 * 1. If scheduled date is in future -> status = scheduled (automatic)
 * 2. If outcome is 'completed' or 'send_invoice' -> status = completed
 * 3. Otherwise -> status = open (unless manually set to cancelled)
 */
export const determineJobStatus = (scheduledDate, outcome, currentStatus = 'open') => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  
  // Rule 1: Future dates ALWAYS return scheduled (highest priority, automatic)
  if (scheduled > today) {
    return 'scheduled';
  }
  
  // If manually cancelled, keep it cancelled
  if (currentStatus === 'cancelled') {
    return 'cancelled';
  }
  
  // Rule 2: Completed outcomes
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'completed';
  }
  
  // Rule 3: Default to open
  return 'open';
};