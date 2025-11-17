/**
 * Determines job status based on scheduled date and outcome
 * Rules:
 * 1. If scheduled date is in future -> status = scheduled
 * 2. If outcome is 'completed' or 'send_invoice' -> status = completed
 * 3. If outcome is 'new_quote', 'update_quote', or 'return_visit_required' -> status = open
 * 4. Otherwise, keep current status
 */
export const determineJobStatus = (scheduledDate, outcome, currentStatus) => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  
  // Rule 1: Future dates always return scheduled
  if (scheduled > today) {
    return 'scheduled';
  }
  
  // Rule 2: Completed outcomes
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'completed';
  }
  
  // Rule 3: Open outcomes
  if (outcome === 'new_quote' || outcome === 'update_quote' || outcome === 'return_visit_required') {
    return 'open';
  }
  
  // Rule 4: Keep current status
  return currentStatus;
};