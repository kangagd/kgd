/**
 * EmailThread linking state helpers
 * EmailThread is the single source of truth for project linkage.
 * Projects never infer emails implicitly.
 */

import { sameId } from './id';

/**
 * Compute all linking states for an EmailThread
 * @param {Object} thread - The EmailThread record
 * @returns {Object} Linking states object
 */
export const getThreadLinkingState = (thread) => {
  if (!thread) return {
    isLinked: false,
    isSuggested: false,
    isIgnored: false,
    suggestedAction: 'none',
    linkedProjectId: null,
    suggestedProjectId: null
  };

  const isLinked = !!thread.project_id;
  const isSuggested = !!thread.ai_suggested_project_id && !isLinked && !thread.ai_suggestion_dismissed_at;
  const isIgnored = !!thread.ai_suggestion_dismissed_at;

  return {
    // Explicit user-set link
    isLinked,
    linkedProjectId: thread.project_id || null,
    linkedProjectTitle: thread.project_title || null,
    linkedProjectNumber: thread.project_number || null,

    // AI suggestion
    isSuggested,
    suggestedProjectId: thread.ai_suggested_project_id || null,
    suggestedAction: thread.ai_suggested_action || 'none',
    
    // User dismissal
    isIgnored,
    dismissedAt: thread.ai_suggestion_dismissed_at || null
  };
};

/**
 * Check if thread can be linked (not already linked)
 */
export const canLinkThread = (thread) => {
  return !thread?.project_id;
};

/**
 * Check if thread can be unlinked (currently linked)
 */
export const canUnlinkThread = (thread) => {
  return !!thread?.project_id;
};

/**
 * Check if AI suggestion should be shown
 */
export const shouldShowAISuggestion = (thread) => {
  if (!thread) return false;
  // Show if suggested and not dismissed and not already linked
  return !!thread.ai_suggested_project_id &&
    !thread.project_id &&
    !thread.ai_suggestion_dismissed_at;
};