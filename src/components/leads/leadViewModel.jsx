/**
 * Lead Management Console - View Model Definition
 * 
 * This file defines the shape of the LeadView derived read-model and stable constants.
 * No computation logic - just types and enums.
 */

// ============================================================================
// ENUM CONSTANTS
// ============================================================================

export const LEAD_STAGES = Object.freeze({
  NEW: "new",
  PRICING: "pricing",
  QUOTE_DRAFT: "quote_draft",
  QUOTE_SENT: "quote_sent",
  ENGAGED: "engaged",
  STALLED: "stalled",
  WON: "won",
  LOST: "lost",
});

export const TEMP_BUCKETS = Object.freeze({
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
});

export const NEXT_ACTIONS = Object.freeze({
  CALL: "call",
  EMAIL: "email",
  SMS: "sms",
  WAIT: "wait",
  ARCHIVE: "archive",
  NONE: "none",
});

// ============================================================================
// DEFAULT THRESHOLDS (TUNABLE CONFIG)
// ============================================================================

export const DEFAULT_LEAD_THRESHOLDS = Object.freeze({
  engaged_window_days: 7,     // customer activity within this window can mark "engaged"
  stalled_after_days: 7,      // no customer activity after this becomes "stalled"
  archive_after_days: 21,     // cold long enough to suggest archive
  hot_score_min: 30,
  warm_score_min: 15,
  high_value_quote: 10000,
  very_high_value_quote: 25000,
});

// ============================================================================
// TYPEDEFS (JSDoc)
// ============================================================================

/**
 * @typedef {typeof LEAD_STAGES[keyof typeof LEAD_STAGES]} LeadStage
 */

/**
 * @typedef {typeof TEMP_BUCKETS[keyof typeof TEMP_BUCKETS]} TemperatureBucket
 */

/**
 * @typedef {typeof NEXT_ACTIONS[keyof typeof NEXT_ACTIONS]} NextAction
 */

/**
 * @typedef {Object} LeadView
 * 
 * @property {string} project_id
 * @property {string|null} project_number
 * @property {string|null} title
 * @property {string|null} address_suburb
 * 
 * @property {string|null} customer_id
 * @property {string|null} customer_name
 * @property {string|null} customer_email
 * @property {string|null} customer_phone
 * 
 * @property {string|null} primary_quote_id
 * @property {string|null} primary_quote_status
 * @property {number|null} primary_quote_value
 * @property {string|null} primary_quote_created_at
 * 
 * @property {LeadStage} lead_stage
 * @property {boolean} is_active
 * 
 * @property {string|null} last_message_at
 * @property {string|null} last_customer_message_at
 * @property {string|null} last_internal_message_at
 * @property {"customer"|"internal"|"unknown"} last_touch_direction
 * @property {number|null} days_since_customer
 * @property {number|null} days_since_internal
 * 
 * @property {number} temperature_score
 * @property {TemperatureBucket} temperature_bucket
 * @property {string[]} temperature_reasons
 * 
 * @property {NextAction} next_action
 * @property {string|null} next_action_reason
 * @property {string|null} follow_up_due_at
 * 
 * @property {number} thread_count
 * @property {boolean} has_unread
 * @property {string|null} assigned_to
 * 
 * @property {string|null} source_project_status
 * @property {any[]|null} source_quote_checklist
 * @property {string|null} source_primary_quote_status_raw
 */