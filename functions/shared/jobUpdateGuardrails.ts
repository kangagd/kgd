
/**
 * Job Update Guardrails
 * 
 * Enforces hard rules for job updates:
 * - Draft-safe fields can be updated anytime
 * - Completion payload only during final checkout
 * - No empty overwrites on completion fields
 * - Address sync only fills empty, never overwrites
 */

const COMPLETION_FIELDS = new Set([
  'status',
  'outcome',
  'overview',
  'completion_notes',
  'next_steps',
  'communication_with_client'
]);

const DRAFT_SAFE_FIELDS = new Set([
  'measurements',
  'image_urls',
  'other_documents',
  'notes',
  'pricing_provided',
  'additional_info',
  'issues_found',
  'resolution'
]);

/**
 * Apply guardrails to a job update
 * 
 * @param {Object} existingJob - The current job record
 * @param {Object} incomingPatch - The incoming update data
 * @param {string} mode - 'draft' (any tech) or 'final_checkout' (last tech only)
 * @param {string} actorEmail - Email of user making the update
 * @returns {Object} { cleanPatch, blockedFields, shouldLog }
 */
export function applyJobUpdateGuardrails(existingJob, incomingPatch, mode = 'draft', actorEmail = null) {
  const blockedFields = [];
  const cleanPatch = { ...incomingPatch };

  // In draft mode, strip completion fields
  if (mode === 'draft') {
    for (const field of COMPLETION_FIELDS) {
      if (field in cleanPatch) {
        blockedFields.push(field);
        delete cleanPatch[field];
      }
    }
  }

  // In final_checkout mode, apply "no empty overwrite" rules
  if (mode === 'final_checkout') {
    for (const field of COMPLETION_FIELDS) {
      if (field in cleanPatch) {
        const incomingValue = cleanPatch[field];
        const existingValue = existingJob?.[field];

        // Don't overwrite non-empty with empty
        if (!incomingValue && existingValue) {
          console.warn(`[JobGuardrail] Blocked empty overwrite of ${field} in final_checkout. Actor: ${actorEmail}`);
          delete cleanPatch[field];
        }
      }
    }
  }

  // Address sync: only fill if empty, never overwrite
  const addressFields = ['address_full', 'address_street', 'address_suburb', 'address_state', 'address_postcode', 'google_place_id', 'latitude', 'longitude'];
  for (const field of addressFields) {
    if (field in cleanPatch && cleanPatch[field] && existingJob?.[field]) {
      // Incoming has value, existing has value → this is a manual override, allow it
      // (address_overridden_at and address_overridden_by will be set separately)
      continue;
    } else if (field in cleanPatch && !cleanPatch[field] && existingJob?.[field]) {
      // Incoming is empty but existing has value → don't overwrite
      delete cleanPatch[field];
    }
  }

  const shouldLog = blockedFields.length > 0;

  return { cleanPatch, blockedFields, shouldLog };
}

/**
 * Safely merge draft field arrays (dedupe by URL/identity)
 * 
 * @param {Array} existing - Existing array
 * @param {Array} incoming - Incoming array
 * @returns {Array} Merged, deduplicated array
 */
export function mergeDraftArrays(existing, incoming) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(incoming)) incoming = [];

  const merged = [...existing, ...incoming];
  // Dedupe by converting to Set (for strings/primitives)
  return [...new Set(merged)];
}

/**
 * Safely merge draft field objects (shallow merge, no overwrites with empty)
 * 
 * @param {Object} existing - Existing object
 * @param {Object} incoming - Incoming object
 * @returns {Object} Merged object
 */
export function mergeDraftObjects(existing, incoming) {
  if (!existing || typeof existing !== 'object') existing = {};
  if (!incoming || typeof incoming !== 'object') incoming = {};

  const merged = { ...existing };
  for (const key in incoming) {
    if (incoming[key] !== null && incoming[key] !== undefined && incoming[key] !== '') {
      merged[key] = incoming[key];
    }
  }
  return merged;
}

/**
 * Log blocked completion field write
 * 
 * @param {string} jobId - Job ID
 * @param {string} actorEmail - Actor email
 * @param {Array} blockedFields - Fields that were blocked
 * @param {string} source - Source (function/component name)
 */
export function logBlockedCompletionWrite(jobId, actorEmail, blockedFields, source) {
  console.warn(`[JobGuardrail] Blocked completion write attempt`, {
    jobId,
    actorEmail,
    blockedFields,
    source,
    timestamp: new Date().toISOString()
  });
}
