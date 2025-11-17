/**
 * Determines job status based on scheduled date, outcome, and check-in status
 * Rules (in order of priority):
 * 1. If scheduled date is in future -> status = scheduled (overrides everything)
 * 2. If there's an active check-in (checked in but not out) -> status = in_progress
 * 3. If outcome is 'completed' or 'send_invoice' -> status = completed
 * 4. If outcome is 'new_quote', 'update_quote', or 'return_visit_required' -> status = open
 * 5. Otherwise, return current status or 'open'
 */
export const determineJobStatus = (scheduledDate, outcome, hasActiveCheckIn = false, currentStatus = 'open') => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  
  // Rule 1: Future dates ALWAYS return scheduled (highest priority)
  if (scheduled > today) {
    return 'scheduled';
  }
  
  // Rule 2: Active check-in means in progress
  if (hasActiveCheckIn) {
    return 'in_progress';
  }
  
  // Rule 3: Completed outcomes
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'completed';
  }
  
  // Rule 4: Open outcomes
  if (outcome === 'new_quote' || outcome === 'update_quote' || outcome === 'return_visit_required') {
    return 'open';
  }
  
  // Rule 5: Default to current status or open
  return currentStatus || 'open';
};