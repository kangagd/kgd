/**
 * Lead Management Console - Communication Rollup Calculator
 * 
 * Used by Lead Console derived view to aggregate email thread stats.
 * Must remain null-safe and deterministic.
 * No network calls.
 * 
 * Aggregates:
 * - Thread count, unread status, assignment
 * - Last message timestamps (overall, customer, internal)
 * - Last touch direction
 * - Days since last contact
 */

// ============================================================================
// SAFE HELPERS
// ============================================================================

/**
 * Safe array normalization
 * @param {any} v
 * @returns {Array}
 */
const safeArr = (v) => (Array.isArray(v) ? v : []);

/**
 * Safe ISO string normalization
 * @param {any} v
 * @returns {string|null}
 */
const safeIso = (v) => (typeof v === "string" && v.length >= 10 ? v : null);

/**
 * Convert ISO string to milliseconds
 * @param {string|null} iso
 * @returns {number|null}
 */
const toMs = (iso) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Return the ISO string with the larger timestamp
 * @param {string|null} aIso
 * @param {string|null} bIso
 * @returns {string|null}
 */
const maxIso = (aIso, bIso) => {
  const aMs = toMs(aIso);
  const bMs = toMs(bIso);
  
  if (aMs === null && bMs === null) return null;
  if (aMs === null) return bIso;
  if (bMs === null) return aIso;
  
  return aMs >= bMs ? aIso : bIso;
};

/**
 * Calculate days between two ISO dates
 * @param {string|null} nowIso
 * @param {string|null} pastIso
 * @returns {number|null}
 */
const daysBetween = (nowIso, pastIso) => {
  const nowMs = toMs(nowIso);
  const pastMs = toMs(pastIso);
  
  if (nowMs === null || pastMs === null) return null;
  
  const diffMs = nowMs - pastMs;
  const days = Math.floor(diffMs / 86400000);
  
  return days >= 0 ? days : 0; // Clamp to non-negative
};

// ============================================================================
// FIELD EXTRACTION (tolerant to naming)
// ============================================================================

/**
 * Extract unread flag from thread
 * @param {Object} thread
 * @returns {boolean}
 */
const getUnreadFlag = (thread) => {
  if (!thread || typeof thread !== "object") return false;
  return !!(thread.isUnread || thread.is_unread || thread.unread);
};

/**
 * Extract assigned_to from thread
 * @param {Object} thread
 * @returns {string|null}
 */
const getAssignedTo = (thread) => {
  if (!thread || typeof thread !== "object") return null;
  const value = thread.assigned_to || thread.assignedTo || thread.owner;
  return typeof value === "string" && value.trim() ? value : null;
};

/**
 * Extract last message timestamp from thread
 * @param {Object} thread
 * @returns {string|null}
 */
const getLastMessageAt = (thread) => {
  if (!thread || typeof thread !== "object") return null;
  return safeIso(
    thread.last_message_date ||
    thread.lastMessageDate ||
    thread.last_message_at ||
    thread.updated_at
  );
};

/**
 * Extract last internal message timestamp from thread
 * @param {Object} thread
 * @returns {string|null}
 */
const getLastInternalMessageAt = (thread) => {
  if (!thread || typeof thread !== "object") return null;
  return safeIso(
    thread.lastInternalMessageAt ||
    thread.last_internal_message_at
  );
};

/**
 * Extract last customer message timestamp from thread
 * @param {Object} thread
 * @returns {string|null}
 */
const getLastCustomerMessageAt = (thread) => {
  if (!thread || typeof thread !== "object") return null;
  return safeIso(
    thread.lastExternalMessageAt ||
    thread.last_external_message_at
  );
};

/**
 * Get activity time for a thread (for sorting)
 * @param {Object} thread
 * @returns {string|null}
 */
const getActivityTime = (thread) => {
  const lastMsg = getLastMessageAt(thread);
  const updated = safeIso(thread?.updated_at);
  return maxIso(lastMsg, updated);
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute communication rollup stats for a project's email threads.
 * 
 * @param {Array} threadsForProject - Array of EmailThread entities for this project
 * @param {string|null} nowIso - Current time ISO string (defaults to now)
 * @returns {Object} Communication stats object
 */
export const computeCommsRollup = (threadsForProject = [], nowIso = null) => {
  const threads = safeArr(threadsForProject);
  const now = nowIso || new Date().toISOString();
  
  // Initialize result
  const result = {
    thread_count: threads.length,
    has_unread: false,
    assigned_to: null,
    last_message_at: null,
    last_customer_message_at: null,
    last_internal_message_at: null,
    last_touch_direction: "unknown",
    days_since_customer: null,
    days_since_internal: null,
  };
  
  // Early return if no threads
  if (threads.length === 0) {
    return result;
  }
  
  // Aggregate unread status
  result.has_unread = threads.some((t) => getUnreadFlag(t));
  
  // Aggregate timestamps
  let lastMessageAtMax = null;
  let lastInternalMax = null;
  let lastCustomerMax = null;
  
  for (const thread of threads) {
    const lastMsg = getLastMessageAt(thread);
    const lastInternal = getLastInternalMessageAt(thread);
    const lastCustomer = getLastCustomerMessageAt(thread);
    
    lastMessageAtMax = maxIso(lastMessageAtMax, lastMsg);
    lastInternalMax = maxIso(lastInternalMax, lastInternal);
    lastCustomerMax = maxIso(lastCustomerMax, lastCustomer);
  }
  
  result.last_message_at = lastMessageAtMax;
  result.last_internal_message_at = lastInternalMax;
  result.last_customer_message_at = lastCustomerMax;
  
  // Determine last touch direction
  if (lastMessageAtMax === null) {
    result.last_touch_direction = "unknown";
  } else if (lastCustomerMax === lastMessageAtMax) {
    result.last_touch_direction = "customer";
  } else if (lastInternalMax === lastMessageAtMax) {
    result.last_touch_direction = "internal";
  } else {
    result.last_touch_direction = "unknown";
  }
  
  // Compute days since last contact
  result.days_since_customer = daysBetween(now, lastCustomerMax);
  result.days_since_internal = daysBetween(now, lastInternalMax);
  
  // Find assigned_to from most recently active thread
  const sortedByActivity = [...threads].sort((a, b) => {
    const aTime = getActivityTime(a);
    const bTime = getActivityTime(b);
    const aMs = toMs(aTime);
    const bMs = toMs(bTime);
    
    if (aMs === null && bMs === null) return 0;
    if (aMs === null) return 1;
    if (bMs === null) return -1;
    
    return bMs - aMs; // Descending (most recent first)
  });
  
  for (const thread of sortedByActivity) {
    const assigned = getAssignedTo(thread);
    if (assigned) {
      result.assigned_to = assigned;
      break;
    }
  }
  
  return result;
};