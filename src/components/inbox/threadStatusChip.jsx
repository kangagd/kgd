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
  // Only support project linking (job linking deprecated)
  if (thread.project_id) {
    return {
      type: 'project',
      number: thread.project_number,
      title: thread.project_title
    };
  }

  if (thread.contract_id) {
    return {
      type: 'contract',
      name: thread.contract_name,
      status: thread.contract_status
    };
  }

  return null;
}