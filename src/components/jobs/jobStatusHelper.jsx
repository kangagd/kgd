/**
 * Determines job status based on scheduled date, outcome, and active check-in
 * NEW UNIFIED STATUS SYSTEM:
 * - Open: Job created but not scheduled yet (or past date with no action)
 * - Scheduled: Has a date/time set
 * - Completed: Job finished (via outcome or manual)
 * - Cancelled: Job cancelled
 */
export const determineJobStatus = (scheduledDate, outcome, hasActiveCheckIn, currentStatus = 'Open') => {
  // Normalize status to new format
  const normalizeStatus = (status) => {
    if (!status) return 'Open';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'open') return 'Open';
    if (lowerStatus === 'scheduled') return 'Scheduled';
    if (lowerStatus === 'completed') return 'Completed';
    if (lowerStatus === 'cancelled') return 'Cancelled';
    return status;
  };
  
  const normalized = normalizeStatus(currentStatus);
  
  // If manually cancelled, keep it cancelled
  if (normalized === 'Cancelled') {
    return 'Cancelled';
  }
  
  // If outcome indicates completion
  if (outcome === 'completed' || outcome === 'send_invoice') {
    return 'Completed';
  }
  
  // If has scheduled date and time -> Scheduled (unless already completed)
  if (scheduledDate && normalized !== 'Completed') {
    return 'Scheduled';
  }
  
  // Default to Open
  return 'Open';
};