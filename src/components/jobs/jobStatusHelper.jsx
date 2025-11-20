/**
 * Determines job status based on scheduled date, time, and outcome
 * Rules (in order of priority):
 * 1. If cancelled manually -> Cancelled
 * 2. If outcome is 'completed' -> Completed
 * 3. If scheduled_date and scheduled_time are set -> Scheduled
 * 4. Otherwise -> Open
 */
export const determineJobStatus = (scheduledDate, scheduledTime, outcome, currentStatus = 'Open') => {
  // Rule 1: Cancelled stays cancelled
  if (currentStatus === 'Cancelled' || currentStatus === 'cancelled') {
    return 'Cancelled';
  }
  
  // Rule 2: Completed outcomes
  if (outcome === 'completed') {
    return 'Completed';
  }
  
  // Rule 3: If date and time are set -> Scheduled
  if (scheduledDate && scheduledTime) {
    return 'Scheduled';
  }
  
  // Rule 4: Default to Open
  return 'Open';
};