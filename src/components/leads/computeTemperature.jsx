/**
 * Lead Management Console - Temperature Scoring
 * 
 * Explainable temperature for Lead Console.
 * Keep reasons human-readable.
 * Thresholds tunable via DEFAULT_LEAD_THRESHOLDS.
 * 
 * Computes:
 * - temperature_score (integer >= 0)
 * - temperature_bucket (hot/warm/cold)
 * - temperature_reasons (explainability)
 */

import { TEMP_BUCKETS, DEFAULT_LEAD_THRESHOLDS, LEAD_STAGES } from "./leadViewModel";

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
 * Clamp number to non-negative integer
 * @param {number} n
 * @returns {number}
 */
const clampInt = (n) => Math.max(0, Math.floor(n));

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute temperature scoring for a lead.
 * 
 * @param {Object|null} leadInput - Lead data with stage, quote, and comms info
 * @param {Object} thresholds - Configuration thresholds
 * @returns {{temperature_score: number, temperature_bucket: string, temperature_reasons: string[]}}
 */
export const computeTemperature = (leadInput, thresholds = DEFAULT_LEAD_THRESHOLDS) => {
  let score = 0;
  const reasons = [];

  // Helper to add points and reason
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  // Extract normalized values
  const stage = norm(leadInput?.lead_stage);
  const quoteStatus = norm(leadInput?.primary_quote_status);
  const quoteValue = safeNum(leadInput?.primary_quote_value);
  const dsc = safeNum(leadInput?.days_since_customer);
  const hasUnread = leadInput?.has_unread === true;

  // ============================================================================
  // RULE 1: Quote presence / state
  // ============================================================================
  if (quoteStatus === "sent") {
    add(15, "Quote sent");
  } else if (quoteStatus === "draft") {
    add(5, "Quote draft");
  }

  // ============================================================================
  // RULE 2: Quote value
  // ============================================================================
  if (quoteValue !== null) {
    if (quoteValue >= thresholds.very_high_value_quote) {
      add(10, "Very high value quote");
    }
    if (quoteValue >= thresholds.high_value_quote) {
      add(10, "High value quote");
    }
  }

  // ============================================================================
  // RULE 3: Customer recency
  // ============================================================================
  if (dsc !== null) {
    if (dsc <= 2) {
      add(20, "Recent customer activity");
    } else if (dsc >= 3 && dsc <= 6) {
      add(10, "Customer active this week");
    } else if (dsc >= thresholds.stalled_after_days) {
      add(-15, "No customer reply for 7+ days");
    }
  }

  // ============================================================================
  // RULE 4: Unread
  // ============================================================================
  if (hasUnread) {
    add(10, "Unread customer message");
  }

  // ============================================================================
  // RULE 5: Stage penalties (won/lost force to cold)
  // ============================================================================
  if (stage === LEAD_STAGES.WON) {
    score = 0;
    reasons.length = 0; // Clear reasons
    reasons.push("Won");
  } else if (stage === LEAD_STAGES.LOST) {
    score = 0;
    reasons.length = 0; // Clear reasons
    reasons.push("Lost");
  } else if (stage === LEAD_STAGES.STALLED) {
    add(-10, "Stalled");
  }

  // ============================================================================
  // RULE 6: Clamp
  // ============================================================================
  score = clampInt(score);

  // ============================================================================
  // BUCKET MAPPING
  // ============================================================================
  let bucket = TEMP_BUCKETS.COLD;

  if (score >= thresholds.hot_score_min) {
    bucket = TEMP_BUCKETS.HOT;
  } else if (score >= thresholds.warm_score_min) {
    bucket = TEMP_BUCKETS.WARM;
  }

  return {
    temperature_score: score,
    temperature_bucket: bucket,
    temperature_reasons: reasons,
  };
};