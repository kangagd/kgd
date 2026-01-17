/**
 * Job Model Rules - Single Source of Truth for Job V2 vs Legacy UI
 * 
 * GUARDRAILS:
 * - All V2 logic must check the feature flag first
 * - Never mutate job data in these helpers
 * - These functions must be pure (no side effects)
 */

import { isFeatureEnabled } from '../domain/featureFlags';

/**
 * Cutoff date for Job V2 model (jobs created after this use V2 by default)
 * Set to a future date initially - update when V2 is fully rolled out
 */
const JOB_V2_CUTOFF_DATE = new Date('2026-06-01T00:00:00Z');

/**
 * Determines if Job V2 model is enabled for a specific job
 * 
 * @param {Object} job - Job entity
 * @returns {boolean} - true if V2 should be used for this job
 */
export function isJobV2Enabled(job) {
  if (!job) return false;
  
  // Feature flag must be ON
  const flagEnabled = isFeatureEnabled('visits_enabled');
  if (!flagEnabled) return false;

  // V2 enabled if any of these conditions are true:
  // 1. Job has visits (visit_count > 0)
  // 2. Job explicitly marked as V2 (job_model_version >= 2)
  // 3. Job created after cutoff date
  
  if (job.visit_count && job.visit_count > 0) return true;
  if (job.job_model_version && job.job_model_version >= 2) return true;
  
  // Check if created after cutoff
  if (job.created_date) {
    const createdDate = new Date(job.created_date);
    if (createdDate >= JOB_V2_CUTOFF_DATE) return true;
  }
  
  return false;
}

/**
 * Determines if legacy Job sections should be hidden
 * Legacy sections: Job Info fields, old notes, legacy pricing fields
 * 
 * @param {Object} job - Job entity
 * @returns {boolean} - true if legacy sections should be hidden
 */
export function shouldHideLegacySections(job) {
  if (!job) return false;
  
  // Only hide if V2 is enabled
  if (!isJobV2Enabled(job)) return false;

  // Hide legacy sections if:
  // - Job has actual visits (visit_count > 0), OR
  // - Job is explicitly V2 (job_model_version >= 2)
  
  if (job.visit_count && job.visit_count > 0) return true;
  if (job.job_model_version && job.job_model_version >= 2) return true;
  
  return false;
}

/**
 * Checks if job has Visit-based execution data
 * 
 * @param {Object} job - Job entity
 * @param {Array} visits - Array of Visit entities for this job
 * @returns {boolean} - true if visits exist
 */
export function hasVisitExecution(job, visits = []) {
  if (!job) return false;
  
  // Check visits array
  if (visits && visits.length > 0) return true;
  
  // Fallback: check job.visit_count field
  if (job.visit_count && job.visit_count > 0) return true;
  
  return false;
}

/**
 * LEGACY FIELD DETECTION
 * Fields that belong to the old Job model and should not be used in V2
 */
export const LEGACY_JOB_FIELDS = [
  'work_performed',
  'issues_found', 
  'resolution',
  'communication_notes',
  'next_steps',
  'completion_notes',
  'measurements',
  'image_urls',
  'photos'
];

/**
 * Detects if a mutation payload contains legacy fields
 * 
 * @param {Object} payload - Mutation data being sent to API
 * @returns {Array<string>} - Array of legacy field names found in payload
 */
export function detectLegacyFields(payload) {
  if (!payload || typeof payload !== 'object') return [];
  
  const foundLegacyFields = [];
  
  for (const fieldName of LEGACY_JOB_FIELDS) {
    if (payload.hasOwnProperty(fieldName)) {
      foundLegacyFields.push(fieldName);
    }
  }
  
  return foundLegacyFields;
}

/**
 * Dev warning helper - logs drift detection warnings
 * Only runs in development/when flag enabled
 * 
 * @param {string} driftType - Type of drift detected
 * @param {Object} context - Additional context for debugging
 */
export function warnJobV2Drift(driftType, context = {}) {
  // Only warn in development or when explicitly enabled
  const shouldWarn = process.env.NODE_ENV !== 'production' || isFeatureEnabled('debug_mode');
  
  if (!shouldWarn) return;
  
  console.warn(`[JOB_V2_DRIFT] ${driftType}`, {
    timestamp: new Date().toISOString(),
    ...context
  });
}