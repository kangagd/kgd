/**
 * inferredStateAutoClear.js - Compute inferred state with auto-clear logic
 * 
 * Auto-clear rule:
 * - If inferredState would be 'waiting_on_customer' but lastInternalMessageAt
 *   is older than WAITING_AUTO_CLEAR_DAYS, return 'none' instead
 * - 'needs_reply' is never auto-cleared
 * - This is applied dynamically wherever inferredState is used (no migrations needed)
 */

const WAITING_AUTO_CLEAR_DAYS = 14;

/**
 * Compute the effective inferred state, applying auto-clear rules
 * @param {Object} thread - EmailThread record
 * @returns {string} 'needs_reply' | 'waiting_on_customer' | 'none'
 */
export function computeInferredStateWithAutoClear(thread) {
  if (!thread) return 'none';

  // If thread is manually closed, no state
  if (thread.userStatus === 'closed') {
    return 'none';
  }

  // Base inferred state from thread
  const baseState = thread.inferredState || 'none';

  // Apply auto-clear rule: if waiting_on_customer and lastInternalMessageAt is stale, return 'none'
  if (baseState === 'waiting_on_customer' && thread.lastInternalMessageAt) {
    const lastInternalTime = new Date(thread.lastInternalMessageAt);
    const now = new Date();
    const daysSinceLastInternal = (now.getTime() - lastInternalTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastInternal > WAITING_AUTO_CLEAR_DAYS) {
      return 'none';
    }
  }

  return baseState;
}

/**
 * Get the display state for a thread (used in UI)
 * Wraps computeInferredStateWithAutoClear
 */
export function getThreadDisplayState(thread) {
  return computeInferredStateWithAutoClear(thread);
}

export { WAITING_AUTO_CLEAR_DAYS };