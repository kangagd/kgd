/**
 * Lead Management Console - Next Action Decision Engine
 * 
 * Deterministic next-step engine for Lead Console.
 * No side effects; thresholds tuneable.
 * Used to drive "Recommended Action" column.
 * 
 * Computes:
 * - next_action (suggested action for this lead)
 * - next_action_reason (explainability)
 * - follow_up_due_at (when to act; null if wait)
 */

import { NEXT_ACTIONS, DEFAULT_LEAD_THRESHOLDS, LEAD_STAGES } from "./leadViewModel";

// ============================================================================
// SAFE NORMALIZATION HELPERS
// ============================================================================

/**
 * Safe string normalization (lowercase, trimmed)
 * @param {any} v
 * @returns {string}
 */
const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * Safe number normalization
 * @param {any} v
 * @returns {number|null}
 */
const safeNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Safe now ISO normalization
 * @param {string|null} nowIso
 * @returns {string}
 */
const safeNowIso = (nowIso) => {
  if (typeof nowIso === "string" && nowIso.length >= 10) {
    return nowIso;
  }
  return new Date().toISOString();
};

/**
 * Return current timestamp (for due_at)
 * @param {string} now
 * @returns {string}
 */
const dueNow = (now) => now;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute next action and follow-up due date for a lead.
 * 
 * @param {Object|null} leadInput - Lead data with stage, comms, and quote info
 * @param {string|null} nowIso - Current time ISO string (defaults to now)
 * @param {Object} thresholds - Configuration thresholds
 * @returns {{next_action: string, next_action_reason: string|null, follow_up_due_at: string|null}}
 */
export const computeNextAction = (
  leadInput,
  nowIso = null,
  thresholds = DEFAULT_LEAD_THRESHOLDS
) => {
  const now = safeNowIso(nowIso);

  // Extract normalized values
  const stage = norm(leadInput?.lead_stage);
  const quoteStatus = norm(leadInput?.primary_quote_status);
  const hasUnread = leadInput?.has_unread === true;
  const dsc = safeNum(leadInput?.days_since_customer);
  const dsi = safeNum(leadInput?.days_since_internal);

  // ============================================================================
  // RULE 1: Terminal stages
  // ============================================================================
  if (stage === LEAD_STAGES.WON) {
    return {
      next_action: NEXT_ACTIONS.NONE,
      next_action_reason: "Won",
      follow_up_due_at: null,
    };
  }

  if (stage === LEAD_STAGES.LOST) {
    return {
      next_action: NEXT_ACTIONS.NONE,
      next_action_reason: "Lost",
      follow_up_due_at: null,
    };
  }

  // ============================================================================
  // RULE 2: Unread customer message
  // ============================================================================
  if (hasUnread) {
    return {
      next_action: NEXT_ACTIONS.EMAIL,
      next_action_reason: "Unread customer message",
      follow_up_due_at: dueNow(now),
    };
  }

  // ============================================================================
  // RULE 3: Engaged lead (closing motion)
  // ============================================================================
  if (stage === LEAD_STAGES.ENGAGED) {
    if (dsi !== null && dsi >= 2) {
      return {
        next_action: NEXT_ACTIONS.CALL,
        next_action_reason: "Engaged lead; time to close",
        follow_up_due_at: dueNow(now),
      };
    } else {
      return {
        next_action: NEXT_ACTIONS.WAIT,
        next_action_reason: "Recently contacted; wait",
        follow_up_due_at: null,
      };
    }
  }

  // ============================================================================
  // RULE 4: Quote sent (initial follow-up)
  // ============================================================================
  if (stage === LEAD_STAGES.QUOTE_SENT) {
    if (dsi !== null && dsi >= 2 && dsc === null) {
      return {
        next_action: NEXT_ACTIONS.SMS,
        next_action_reason: "Quote sent; no customer response yet",
        follow_up_due_at: dueNow(now),
      };
    }
    if (dsc !== null && dsc >= 2) {
      return {
        next_action: NEXT_ACTIONS.CALL,
        next_action_reason: "Customer replied earlier; progress conversation",
        follow_up_due_at: dueNow(now),
      };
    } else {
      return {
        next_action: NEXT_ACTIONS.WAIT,
        next_action_reason: "Quote recently sent; wait",
        follow_up_due_at: null,
      };
    }
  }

  // ============================================================================
  // RULE 5: Stalled leads
  // ============================================================================
  if (stage === LEAD_STAGES.STALLED) {
    if (dsc !== null && dsc >= thresholds.archive_after_days) {
      return {
        next_action: NEXT_ACTIONS.ARCHIVE,
        next_action_reason: "Cold for 3+ weeks; archive",
        follow_up_due_at: dueNow(now),
      };
    } else {
      return {
        next_action: NEXT_ACTIONS.EMAIL,
        next_action_reason: "Stalled; send follow-up",
        follow_up_due_at: dueNow(now),
      };
    }
  }

  // ============================================================================
  // RULE 6: Quote draft
  // ============================================================================
  if (stage === LEAD_STAGES.QUOTE_DRAFT) {
    return {
      next_action: NEXT_ACTIONS.EMAIL,
      next_action_reason: "Draft quote; progress toward sending",
      follow_up_due_at: dueNow(now),
    };
  }

  // ============================================================================
  // RULE 7: Pricing stage
  // ============================================================================
  if (stage === LEAD_STAGES.PRICING) {
    return {
      next_action: NEXT_ACTIONS.EMAIL,
      next_action_reason: "Pricing stage; progress toward quote",
      follow_up_due_at: dueNow(now),
    };
  }

  // ============================================================================
  // RULE 8: New lead
  // ============================================================================
  if (stage === LEAD_STAGES.NEW) {
    return {
      next_action: NEXT_ACTIONS.EMAIL,
      next_action_reason: "New lead; make first contact or gather info",
      follow_up_due_at: dueNow(now),
    };
  }

  // ============================================================================
  // RULE 9: Fallback (unknown stage)
  // ============================================================================
  if (quoteStatus === "sent") {
    return {
      next_action: NEXT_ACTIONS.EMAIL,
      next_action_reason: "Quote sent; follow up",
      follow_up_due_at: dueNow(now),
    };
  } else {
    return {
      next_action: NEXT_ACTIONS.WAIT,
      next_action_reason: "No clear action",
      follow_up_due_at: null,
    };
  }
};