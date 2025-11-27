/**
 * Determines job status based on scheduled date, outcome, and active check-in
 * Rules (in order of priority):
 * 1. If scheduled date is in future -> status = scheduled (automatic)
 * 2. If manually cancelled, keep it cancelled
 * 3. If outcome is 'completed' or 'send_invoice' -> status = completed
 * 4. Otherwise -> status = open
 */
export const determineJobStatus = (scheduledDate, outcome, hasActiveCheckIn, currentStatus = 'open') => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  
  // Rule 1: Future dates ALWAYS return Scheduled (highest priority, automatic)
  if (scheduled > today) {
    return 'Scheduled';
  }
  
  // If manually cancelled, keep it Cancelled
  if (currentStatus === 'Cancelled') {
    return 'Cancelled';
  }
  
  // Rule 2: Completed outcomes
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'Completed';
  }
  
  // Rule 3: Default to Open
  return 'Open';
};