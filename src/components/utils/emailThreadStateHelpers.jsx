/**
 * Shared utility for computing EmailThread inferred state
 * Single-source-of-truth for status chip logic across all surfaces
 * 
 * CHIP PRIORITY (top → bottom):
 * 1. Closed
 * 2. Needs reply
 * 3. Waiting on customer
 * 4. Open
 * 5. No chip (Untriaged)
 */

/**
 * Compute inferred state based on message direction and timestamps
 * Used internally for getStatusChip()
 */
function getInferredState(thread) {
  const lastExternal = thread.lastExternalMessageAt ? new Date(thread.lastExternalMessageAt) : null;
  const lastInternal = thread.lastInternalMessageAt ? new Date(thread.lastInternalMessageAt) : null;

  // No message history
  if (!lastExternal && !lastInternal) {
    return 'none';
  }

  // Last message from external party → needs reply
  if (thread.lastMessageDirection === 'external') {
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
 * SINGLE STATUS CHIP SYSTEM
 * Returns the ONE primary status chip to display, following priority order
 * Returns null if no status chip should be shown
 */
export function getStatusChip(thread) {
  // Priority 1: Closed (always overrides everything)
  if (thread.userStatus === 'closed') {
    return {
      label: 'Closed',
      key: 'closed',
      color: 'gray'
    };
  }

  // Priority 2: Needs reply
  const inferred = getInferredState(thread);
  if (inferred === 'needs_reply') {
    return {
      label: 'Needs reply',
      key: 'needs_reply',
      color: 'red'
    };
  }

  // Priority 3: Waiting on customer
  if (inferred === 'waiting_on_customer') {
    return {
      label: 'Waiting on customer',
      key: 'waiting_on_customer',
      color: 'amber'
    };
  }

  // Priority 4: Open (only if linked)
  if (thread.linkedEntityType && thread.linkedEntityType !== 'none') {
    return {
      label: 'Open',
      key: 'open',
      color: 'blue'
    };
  }

  // Priority 5: No chip (Untriaged)
  return null;
}

/**
 * LINK CHIP (separate from status chip)
 * Returns link metadata if thread is linked, null otherwise
 */
export function getLinkChip(thread) {
  if (!thread.linkedEntityType || thread.linkedEntityType === 'none') {
    return null;
  }

  const label = thread.linkedEntityType === 'project'
    ? `Project: #${thread.linkedEntityNumber} ${thread.linkedEntityTitle}`
    : `Job: #${thread.linkedEntityNumber} ${thread.linkedEntityTitle}`;

  return {
    type: thread.linkedEntityType,
    id: thread.linkedEntityId,
    label,
    isAuto: thread.linkSource === 'auto',
    isManual: thread.linkSource === 'manual'
  };
}

/**
 * Check if thread is linked (for filters)
 */
export function isLinked(thread) {
  return thread.linkedEntityType && thread.linkedEntityType !== 'none';
}