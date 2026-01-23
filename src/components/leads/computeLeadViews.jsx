/**
 * Lead Management Console - Derived LeadView Composer
 * 
 * Derived LeadView composer for Lead Console.
 * Performance: O(N) grouping + O(P) compose.
 * No side effects, safe for UI render paths.
 * 
 * Combines:
 * - Projects (filtered by eligibility)
 * - Quotes (resolved to primary quote)
 * - EmailThreads (rolled up to comms stats)
 * 
 * Computes full LeadView with:
 * - Lead stage
 * - Temperature scoring
 * - Next action recommendations
 * - Communication rollups
 */

import { DEFAULT_LEAD_THRESHOLDS, LEAD_STAGES } from "./leadViewModel";
import { isProjectLeadEligible } from "./isProjectLeadEligible";
import { resolvePrimaryQuote } from "./resolvePrimaryQuote";
import { computeCommsRollup } from "./computeCommsRollup";
import { computeLeadStage } from "./computeLeadStage";
import { computeTemperature } from "./computeTemperature";
import { computeNextAction } from "./computeNextAction";

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
 * Safe timestamp to milliseconds for sorting
 * @param {string|null} iso
 * @returns {number}
 */
const toMsForSort = (iso) => {
  if (!iso || typeof iso !== "string") return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

// ============================================================================
// GROUPING HELPER
// ============================================================================

/**
 * Group items by project_id into a plain object map.
 * 
 * @param {Array} items - Array of items to group
 * @param {Function} getProjectIdFn - Function to extract project_id from item
 * @returns {Object} Map of { [projectId]: item[] }
 */
export const groupByProjectId = (items = [], getProjectIdFn) => {
  const grouped = {};
  const safeItems = safeArr(items);

  for (const item of safeItems) {
    if (!item) continue;
    
    const projectId = getProjectIdFn(item);
    if (!projectId || typeof projectId !== "string") continue;

    if (!grouped[projectId]) {
      grouped[projectId] = [];
    }
    grouped[projectId].push(item);
  }

  return grouped;
};

// ============================================================================
// MAIN COMPOSER
// ============================================================================

/**
 * Compute LeadView list from projects, quotes, and threads.
 * 
 * @param {Object} params
 * @param {Array} params.projects - Project entities
 * @param {Array} params.quotes - Quote entities
 * @param {Array} params.threads - EmailThread entities
 * @param {string|null} params.nowIso - Current time ISO string
 * @param {Object} params.thresholds - Configuration thresholds
 * @param {Object} params.eligibilityOpts - Options for isProjectLeadEligible
 * @returns {Array} Array of LeadView objects
 */
export const computeLeadViews = ({
  projects = [],
  quotes = [],
  threads = [],
  nowIso = null,
  thresholds = DEFAULT_LEAD_THRESHOLDS,
  eligibilityOpts = {},
}) => {
  // Normalize inputs
  const safeProjects = safeArr(projects);
  const safeQuotes = safeArr(quotes);
  const safeThreads = safeArr(threads);
  const now = safeNowIso(nowIso);

  // Pre-group child records once (no N+1)
  const quotesByProjectId = groupByProjectId(
    safeQuotes,
    (q) => q.project_id || q.projectId
  );
  const threadsByProjectId = groupByProjectId(
    safeThreads,
    (t) => t.project_id || t.projectId
  );

  const leadViews = [];

  // Iterate projects once
  for (const project of safeProjects) {
    if (!project || typeof project !== "object") continue;

    // Check eligibility
    if (!isProjectLeadEligible(project, eligibilityOpts)) continue;

    const projectId = project.id;
    if (!projectId) continue;

    // Get related records
    const quotesForProject = quotesByProjectId[projectId] || [];
    const threadsForProject = threadsByProjectId[projectId] || [];

    // Resolve primary quote
    const primaryQuoteSnap = resolvePrimaryQuote(project, quotesForProject);

    // Compute communication rollup
    const comms = computeCommsRollup(threadsForProject, now);

    // Compute lead stage
    const stageOut = computeLeadStage(project, primaryQuoteSnap, comms, thresholds);
    const stage = stageOut.lead_stage;
    const isActive = stageOut.is_active;

    // Stage gate: ONLY include Quote Sent follow-up stages
    const allowedStages = [
      LEAD_STAGES.QUOTE_SENT,
      LEAD_STAGES.ENGAGED,
      LEAD_STAGES.STALLED,
    ];
    if (!allowedStages.includes(stage)) {
      continue; // Skip this project
    }

    // Compute temperature
    const tempOut = computeTemperature(
      {
        lead_stage: stage,
        primary_quote_status: primaryQuoteSnap?.status || null,
        primary_quote_value: primaryQuoteSnap?.value ?? null,
        days_since_customer: comms.days_since_customer,
        has_unread: comms.has_unread,
      },
      thresholds
    );

    // Compute next action
    const nextOut = computeNextAction(
      {
        lead_stage: stage,
        has_unread: comms.has_unread,
        days_since_customer: comms.days_since_customer,
        days_since_internal: comms.days_since_internal,
        primary_quote_status: primaryQuoteSnap?.status || null,
      },
      now,
      thresholds
    );

    // Build complete LeadView object
    const leadView = {
      // Project identifiers
      project_id: projectId,
      project_number: project.project_number || project.number || null,
      title: project.title || project.name || null,
      address_suburb: project.address_suburb || project.suburb || null,

      // Customer info
      customer_id: project.customer_id || null,
      customer_name:
        project.customer_name ||
        project.customerName ||
        project.client_name ||
        null,
      customer_email: project.customer_email || project.email || null,
      customer_phone: project.customer_phone || project.phone || null,

      // Quote fields
      primary_quote_id: primaryQuoteSnap?.id || null,
      primary_quote_status: primaryQuoteSnap?.status || null,
      primary_quote_value: primaryQuoteSnap?.value ?? null,
      primary_quote_created_at: primaryQuoteSnap?.created_at || null,

      // Lead stage
      lead_stage: stage,
      is_active: isActive,

      // Communication rollup
      thread_count: comms.thread_count,
      has_unread: comms.has_unread,
      assigned_to: comms.assigned_to,
      last_message_at: comms.last_message_at,
      last_customer_message_at: comms.last_customer_message_at,
      last_internal_message_at: comms.last_internal_message_at,
      last_touch_direction: comms.last_touch_direction,
      days_since_customer: comms.days_since_customer,
      days_since_internal: comms.days_since_internal,

      // Temperature
      temperature_score: tempOut.temperature_score,
      temperature_bucket: tempOut.temperature_bucket,
      temperature_reasons: tempOut.temperature_reasons,

      // Next action
      next_action: nextOut.next_action,
      next_action_reason: nextOut.next_action_reason,
      follow_up_due_at: nextOut.follow_up_due_at,

      // Source/debugging fields
      source_project_status: project.status || null,
      source_quote_checklist: project.quote_checklist || null,
      source_primary_quote_status_raw: primaryQuoteSnap?.status || null,
    };

    leadViews.push(leadView);
  }

  // Sort by priority: follow_up_due_at, temperature, value, last_message
  leadViews.sort((a, b) => {
    // 1) follow_up_due_at (soonest first, nulls last)
    const aDueMs = toMsForSort(a.follow_up_due_at);
    const bDueMs = toMsForSort(b.follow_up_due_at);
    const aDueNull = !a.follow_up_due_at;
    const bDueNull = !b.follow_up_due_at;

    if (aDueNull && !bDueNull) return 1;
    if (!aDueNull && bDueNull) return -1;
    if (!aDueNull && !bDueNull && aDueMs !== bDueMs) {
      return aDueMs - bDueMs; // Ascending (soonest first)
    }

    // 2) temperature_score desc
    const aTemp = a.temperature_score ?? 0;
    const bTemp = b.temperature_score ?? 0;
    if (aTemp !== bTemp) return bTemp - aTemp;

    // 3) primary_quote_value desc (nulls last)
    const aVal = a.primary_quote_value ?? null;
    const bVal = b.primary_quote_value ?? null;
    const aValNull = aVal === null;
    const bValNull = bVal === null;

    if (aValNull && !bValNull) return 1;
    if (!aValNull && bValNull) return -1;
    if (!aValNull && !bValNull && aVal !== bVal) {
      return bVal - aVal; // Descending
    }

    // 4) last_message_at desc (nulls last)
    const aLastMs = toMsForSort(a.last_message_at);
    const bLastMs = toMsForSort(b.last_message_at);
    const aLastNull = !a.last_message_at;
    const bLastNull = !b.last_message_at;

    if (aLastNull && !bLastNull) return 1;
    if (!aLastNull && bLastNull) return -1;
    if (!aLastNull && !bLastNull && aLastMs !== bLastMs) {
      return bLastMs - aLastMs; // Descending (most recent first)
    }

    return 0;
  });

  return leadViews;
};