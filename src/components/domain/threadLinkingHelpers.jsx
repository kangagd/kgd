/**
 * EmailThread linking state helpers
 * 
 * Single source of truth: EmailThread entity
 * - project_id = explicit user-confirmed link
 * - ai_suggested_project_id = AI suggestion (unconfirmed)
 * - ai_suggested_action = what AI recommends
 * - ai_suggestion_rejected_at = user rejected suggestion
 */

/**
 * Check if thread is explicitly linked to a project
 * @param {Object} thread - EmailThread entity
 * @returns {boolean}
 */
export const isLinked = (thread) => {
  return !!(thread?.project_id);
};

/**
 * Check if thread has AI-suggested project (and not rejected)
 * @param {Object} thread - EmailThread entity
 * @returns {boolean}
 */
export const isSuggested = (thread) => {
  return !!(
    thread?.ai_suggested_project_id &&
    !thread?.ai_suggestion_rejected_at &&
    !isLinked(thread)
  );
};

/**
 * Check if user has ignored/rejected AI suggestion
 * @param {Object} thread - EmailThread entity
 * @returns {boolean}
 */
export const isIgnored = (thread) => {
  return !!(thread?.ai_suggestion_rejected_at);
};

/**
 * Get the appropriate action state for UI display
 * @param {Object} thread - EmailThread entity
 * @returns {string} - "linked" | "suggested" | "ignored" | "none"
 */
export const getLinkingState = (thread) => {
  if (isLinked(thread)) return "linked";
  if (isSuggested(thread)) return "suggested";
  if (isIgnored(thread)) return "ignored";
  return "none";
};

/**
 * Determine if a project link action should be offered
 * @param {Object} thread - EmailThread entity
 * @returns {boolean} - true if user can link/create project
 */
export const canLinkProject = (thread) => {
  return !isLinked(thread);
};

/**
 * Determine if suggestion can be dismissed
 * @param {Object} thread - EmailThread entity
 * @returns {boolean}
 */
export const canDismissSuggestion = (thread) => {
  return isSuggested(thread);
};

/**
 * Check if thread should show linking UI
 * @param {Object} thread - EmailThread entity
 * @returns {boolean}
 */
export const shouldShowLinkingUI = (thread) => {
  return !isLinked(thread);
};