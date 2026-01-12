/**
 * Shared utility for computing EmailThread inferred state
 * Used consistently across Inbox list, thread detail, and project panels
 */

export function getInferredState(thread) {
  // If user explicitly closed, that takes precedence
  if (thread.userStatus === 'closed') {
    return 'closed';
  }

  // Compute inferred state based on message direction and timestamps
  const lastExternal = thread.lastExternalMessageAt ? new Date(thread.lastExternalMessageAt) : null;
  const lastInternal = thread.lastInternalMessageAt ? new Date(thread.lastInternalMessageAt) : null;

  // No message history
  if (!lastExternal && !lastInternal) {
    return 'none';
  }

  // Last message from external party → needs reply
  if (thread.lastMessageDirection === 'external') {
    // Either no internal message yet, or external is newer
    if (!lastInternal || lastExternal > lastInternal) {
      return 'needs_reply';
    }
  }

  // Last message from internal (team) → waiting on customer
  if (thread.lastMessageDirection === 'internal') {
    if (!lastExternal || lastInternal > lastExternal) {
      return 'waiting_on_customer';
    }
  }

  return 'none';
}

/**
 * Get display status for UI (includes userStatus)
 * Priority: closed > inferred state > default
 */
export function getDisplayStatus(thread) {
  if (thread.userStatus === 'closed') {
    return 'Closed';
  }

  const inferred = getInferredState(thread);
  if (inferred === 'needs_reply') {
    return 'Needs reply';
  }
  if (inferred === 'waiting_on_customer') {
    return 'Waiting on customer';
  }

  // If linked but no inferred state, show Open; otherwise Untriaged
  if (thread.linkedEntityType && thread.linkedEntityType !== 'none') {
    return 'Open';
  }

  return 'Untriaged';
}

/**
 * Check if thread is linked to a project or job
 */
export function isLinked(thread) {
  return thread.linkedEntityType && thread.linkedEntityType !== 'none';
}

/**
 * Get link info for display
 */
export function getLinkInfo(thread) {
  if (!isLinked(thread)) return null;

  return {
    type: thread.linkedEntityType, // 'project' or 'job'
    id: thread.linkedEntityId,
    number: thread.linkedEntityNumber,
    title: thread.linkedEntityTitle,
    isAuto: thread.linkSource === 'auto',
    isManual: thread.linkSource === 'manual'
  };
}