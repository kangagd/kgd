/**
 * threadStatusChip.js - Compute which status chip to show for an email thread
 * 
 * Evaluates in order, stops at first match:
 * 1. If userStatus == 'closed' → 'Closed'
 * 2. Else → null (no chip)
 */

export function getThreadStatusChip(thread) {
  // Only show manual closed status
  if (thread.userStatus === 'closed') {
    return {
      label: 'Closed',
      color: 'bg-gray-50 text-gray-700 border-gray-200'
    };
  }

  // No status chip to display
  return null;
}

export function isThreadPinned(thread) {
  return thread.pinnedAt != null;
}

export function getThreadLinkChip(thread) {
  // Use new project_id/job_id fields instead of old linking state
  if (thread.project_id) {
    return {
      type: 'project',
      number: thread.project_number,
      title: thread.project_title
    };
  }

  if (thread.job_id) {
    return {
      type: 'job',
      number: thread.job_number,
      title: thread.job_title
    };
  }

  return null;
}