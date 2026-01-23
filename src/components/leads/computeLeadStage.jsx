/**
 * Lead Management Console - Lead Stage Computation
 * 
 * Deterministic stage computation for derived LeadView.
 * Keep keyword lists broad; thresholds tunable.
 * No UI, no network, no side effects.
 * 
 * Computes lead_stage and is_active based on:
 * - Project status
 * - Primary quote status
 * - Quote checklist flags (pricing requested/received)
 * - Communication rollup (days since customer contact)
 */

import { LEAD_STAGES, DEFAULT_LEAD_THRESHOLDS } from "./leadViewModel";

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

// ============================================================================
// STATUS KEYWORD CONSTANTS
// ============================================================================

const WON_KEYWORDS = ["won"];
const COMPLETED_KEYWORDS = ["completed", "complete", "done", "closed"];
const LOST_KEYWORDS = ["lost"];
const CANCELLED_KEYWORDS = ["cancelled", "canceled"];

// ============================================================================
// QUOTE CHECKLIST FLAGS
// ============================================================================

/**
 * Extract checklist flag from project.quote_checklist
 * @param {Object|null} project
 * @param {string} label - Checklist item label to search for
 * @returns {boolean}
 */
const getChecklistFlag = (project, label) => {
  if (!project || typeof project !== "object") return false;
  
  const checklist = Array.isArray(project.quote_checklist) ? project.quote_checklist : [];
  const normalizedLabel = norm(label);
  
  const item = checklist.find((item) => norm(item?.item) === normalizedLabel);
  return item?.checked === true;
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute lead stage and active status for a project.
 * 
 * @param {Object|null} project - Project entity
 * @param {Object|null} primaryQuoteSnap - Normalized quote snapshot from resolvePrimaryQuote
 * @param {Object|null} commsRollup - Communication rollup from computeCommsRollup
 * @param {Object} thresholds - Configuration thresholds
 * @returns {{lead_stage: string, is_active: boolean, reasons: string[]}}
 */
export const computeLeadStage = (
  project,
  primaryQuoteSnap,
  commsRollup,
  thresholds = DEFAULT_LEAD_THRESHOLDS
) => {
  const reasons = [];

  // Null project check
  if (!project || typeof project !== "object") {
    return {
      lead_stage: LEAD_STAGES.NEW,
      is_active: false,
      reasons: ["missing_project"],
    };
  }

  // Extract key values
  const projectStatus = norm(project.status);
  const quoteStatus = norm(primaryQuoteSnap?.status);
  const daysSinceCustomer = safeNum(commsRollup?.days_since_customer);
  
  const pricingRequested = getChecklistFlag(project, "Pricing Requested");
  const pricingReceived = getChecklistFlag(project, "Pricing Received");

  // ============================================================================
  // RULE 1: LOST (highest priority)
  // ============================================================================
  const isLost =
    LOST_KEYWORDS.includes(projectStatus) ||
    CANCELLED_KEYWORDS.includes(projectStatus) ||
    project.lost_date ||
    quoteStatus === "declined";

  if (isLost) {
    if (LOST_KEYWORDS.includes(projectStatus)) reasons.push("project_status_lost");
    if (CANCELLED_KEYWORDS.includes(projectStatus)) reasons.push("project_status_cancelled");
    if (project.lost_date) reasons.push("has_lost_date");
    if (quoteStatus === "declined") reasons.push("quote_declined");

    return {
      lead_stage: LEAD_STAGES.LOST,
      is_active: false,
      reasons,
    };
  }

  // ============================================================================
  // RULE 2: WON / COMPLETED
  // ============================================================================
  const isWon =
    WON_KEYWORDS.includes(projectStatus) ||
    COMPLETED_KEYWORDS.includes(projectStatus) ||
    project.completed_date ||
    quoteStatus === "accepted";

  if (isWon) {
    if (WON_KEYWORDS.includes(projectStatus)) reasons.push("project_status_won");
    if (COMPLETED_KEYWORDS.includes(projectStatus)) reasons.push("project_status_completed");
    if (project.completed_date) reasons.push("has_completed_date");
    if (quoteStatus === "accepted") reasons.push("quote_accepted");

    return {
      lead_stage: LEAD_STAGES.WON,
      is_active: false,
      reasons,
    };
  }

  // ============================================================================
  // RULE 3: Quote present
  // ============================================================================
  if (primaryQuoteSnap && primaryQuoteSnap.id) {
    let baseStage = LEAD_STAGES.QUOTE_SENT; // Conservative default

    if (quoteStatus === "draft") {
      baseStage = LEAD_STAGES.QUOTE_DRAFT;
      reasons.push("quote_status_draft");
    } else if (quoteStatus === "sent") {
      baseStage = LEAD_STAGES.QUOTE_SENT;
      reasons.push("quote_status_sent");
    } else if (quoteStatus) {
      // Unknown status, treat as sent conservatively
      baseStage = LEAD_STAGES.QUOTE_SENT;
      reasons.push(`quote_status_unhandled:${quoteStatus}`);
    } else {
      // No status, treat as sent
      reasons.push("quote_no_status");
    }

    // Apply overlays for engagement/stalled (only for QUOTE_SENT)
    let finalStage = baseStage;

    // Rule 6: Engagement overlay
    if (baseStage === LEAD_STAGES.QUOTE_SENT) {
      if (
        daysSinceCustomer !== null &&
        daysSinceCustomer <= thresholds.engaged_window_days
      ) {
        finalStage = LEAD_STAGES.ENGAGED;
        reasons.push("recent_customer_activity");
      }
    }

    // Rule 7: Stalled overlay (applies to QUOTE_SENT or ENGAGED)
    if (
      (finalStage === LEAD_STAGES.QUOTE_SENT || finalStage === LEAD_STAGES.ENGAGED) &&
      daysSinceCustomer !== null &&
      daysSinceCustomer >= thresholds.stalled_after_days
    ) {
      finalStage = LEAD_STAGES.STALLED;
      reasons.push("stalled_no_customer_activity");
    }

    return {
      lead_stage: finalStage,
      is_active: true,
      reasons,
    };
  }

  // ============================================================================
  // RULE 4: Pricing
  // ============================================================================
  if (pricingRequested || pricingReceived) {
    if (pricingRequested) reasons.push("pricing_requested");
    if (pricingReceived) reasons.push("pricing_received");

    return {
      lead_stage: LEAD_STAGES.PRICING,
      is_active: true,
      reasons,
    };
  }

  // ============================================================================
  // RULE 5: New
  // ============================================================================
  reasons.push("no_quote_no_pricing");

  return {
    lead_stage: LEAD_STAGES.NEW,
    is_active: true,
    reasons,
  };
};