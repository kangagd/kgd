/**
 * Lead Management Console - Project Eligibility Filter
 * 
 * Determines if a project should appear in the Lead Console by default.
 * Does NOT compute lead stage, temperature, or next actions.
 */

import { LEAD_STAGES } from "./leadViewModel";

// ============================================================================
// STATUS KEYWORD CONSTANTS
// ============================================================================

const COMPLETED_STATUSES = ["completed", "complete", "done", "closed"];
const WON_STATUSES = ["won"];
const LOST_STATUSES = ["lost"];
const CANCELLED_STATUSES = ["cancelled", "canceled"];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Safe string normalization
 * @param {any} v
 * @returns {string}
 */
const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Determines if a project is eligible to appear in the Lead Console (active view).
 * 
 * @param {Object|null|undefined} project - Project entity
 * @param {Object} opts - Options
 * @param {boolean} [opts.include_won=false] - Include won projects
 * @param {boolean} [opts.include_lost=false] - Include lost projects
 * @param {boolean} [opts.include_deleted=false] - Include deleted projects
 * @param {boolean} [opts.include_completed=false] - Include completed projects
 * @returns {boolean} - True if eligible for active lead console
 */
export const isProjectLeadEligible = (project, opts = {}) => {
  const {
    include_won = false,
    include_lost = false,
    include_deleted = false,
    include_completed = false,
  } = opts;

  // Null safety: missing project -> not eligible
  if (!project || typeof project !== "object") {
    return false;
  }

  // 1) Deleted projects
  if (project.deleted_at && !include_deleted) {
    return false;
  }

  // 2) Completed / Won states
  const statusNorm = norm(project.status);
  
  if (COMPLETED_STATUSES.includes(statusNorm) && !include_completed) {
    return false;
  }
  
  if (WON_STATUSES.includes(statusNorm) && !include_won) {
    return false;
  }
  
  // Also check completed_date field
  if (project.completed_date && !include_completed) {
    return false;
  }

  // 3) Lost / Cancelled states
  if (LOST_STATUSES.includes(statusNorm) && !include_lost) {
    return false;
  }
  
  if (CANCELLED_STATUSES.includes(statusNorm) && !include_lost) {
    return false;
  }
  
  // Also check lost_date field
  if (project.lost_date && !include_lost) {
    return false;
  }

  // If not excluded by above rules, it's eligible
  return true;
};

// ============================================================================
// DIAGNOSTICS (OPTIONAL)
// ============================================================================

/**
 * Gets eligibility status with reason for debugging/tooltips.
 * 
 * @param {Object|null|undefined} project - Project entity
 * @param {Object} opts - Same options as isProjectLeadEligible
 * @returns {{eligible: boolean, reason: string}}
 */
export const getProjectLeadEligibilityReason = (project, opts = {}) => {
  const {
    include_won = false,
    include_lost = false,
    include_deleted = false,
    include_completed = false,
  } = opts;

  // Null safety
  if (!project || typeof project !== "object") {
    return { eligible: false, reason: "missing_project" };
  }

  // Check deleted
  if (project.deleted_at && !include_deleted) {
    return { eligible: false, reason: "deleted" };
  }

  const statusNorm = norm(project.status);

  // Check completed
  if (COMPLETED_STATUSES.includes(statusNorm) && !include_completed) {
    return { eligible: false, reason: "completed" };
  }
  
  if (project.completed_date && !include_completed) {
    return { eligible: false, reason: "completed" };
  }

  // Check won
  if (WON_STATUSES.includes(statusNorm) && !include_won) {
    return { eligible: false, reason: "won" };
  }

  // Check lost
  if (LOST_STATUSES.includes(statusNorm) && !include_lost) {
    return { eligible: false, reason: "lost" };
  }
  
  if (project.lost_date && !include_lost) {
    return { eligible: false, reason: "lost" };
  }

  // Check cancelled
  if (CANCELLED_STATUSES.includes(statusNorm) && !include_lost) {
    return { eligible: false, reason: "cancelled" };
  }

  // Eligible
  return { eligible: true, reason: "eligible" };
};