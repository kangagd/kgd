/**
 * Determines the appropriate job status based on various conditions
 */
export const determineJobStatus = (scheduledDate, outcome, isCheckedIn, currentStatus) => {
  // If checked in, always mark as in progress
  if (isCheckedIn) {
    return 'in_progress';
  }

  // If outcome is completed or send_invoice after checkout, mark as completed
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'completed';
  }

  // If has scheduled date and time in the future or today, mark as scheduled
  if (scheduledDate) {
    const today = new Date().toISOString().split('T')[0];
    if (scheduledDate >= today && currentStatus !== 'completed') {
      return 'scheduled';
    }
  }

  // Default to open if no other conditions met
  return currentStatus || 'open';
};

/**
 * Determines if a job should be automatically updated to scheduled
 */
export const shouldAutoSchedule = (scheduledDate, scheduledTime) => {
  return scheduledDate && scheduledTime;
};

/**
 * Get status change message for notifications
 */
export const getStatusChangeMessage = (oldStatus, newStatus, jobNumber, customerName) => {
  const statusLabels = {
    open: 'Open',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    quoted: 'Quoted',
    invoiced: 'Invoiced',
    paid: 'Paid',
    cancelled: 'Cancelled'
  };

  return `Job #${jobNumber} (${customerName}) status changed from ${statusLabels[oldStatus] || oldStatus} to ${statusLabels[newStatus] || newStatus}`;
};