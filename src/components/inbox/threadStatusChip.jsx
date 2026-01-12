/**
 * threadStatusChip.js - Compute which status chip to show for an email thread
 * 
 * Evaluates in order, stops at first match:
 * 1. If userStatus == 'closed' → 'Closed'
 * 2. Else if inferredState == 'needs_reply' → 'Needs reply'
 * 3. Else if inferredState == 'waiting_on_customer' → 'Waiting on customer'
 * 4. Else → null (no chip)
 */

export function getThreadStatusChip(thread) {
  // Priority 1: Manual closed status
  if (thread.userStatus === 'closed') {
    return {
      label: 'Closed',
      color: 'bg-gray-50 text-gray-700 border-gray-200'
    };
  }

  // Priority 2: Needs reply (external message unanswered)
  if (thread.inferredState === 'needs_reply') {
    return {
      label: 'Needs reply',
      color: 'bg-red-50 text-red-700 border-red-200'
    };
  }

  // Priority 3: Waiting on customer (internal message, not expired)
  if (thread.inferredState === 'waiting_on_customer') {
    return {
      label: 'Waiting on customer',
      color: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }

  // No actionable state
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