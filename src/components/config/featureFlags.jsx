/**
 * Feature Flags Configuration
 * 
 * LEGACY_PURCHASING_READ_ONLY: When true, disables all create/update/delete operations
 * on Purchase Orders, Parts, and Logistics. Data remains visible but cannot be modified.
 * This allows safe transition to Purchasing V2 without data loss.
 */

export const FEATURE_FLAGS = {
  LEGACY_PURCHASING_READ_ONLY: true,
};

/**
 * Helper to check if legacy purchasing mutations should be blocked
 */
export function isLegacyPurchasingReadOnly() {
  return FEATURE_FLAGS.LEGACY_PURCHASING_READ_ONLY;
}

/**
 * Standard warning logger for blocked legacy operations
 */
export function logLegacyReadOnlyBlock(component, action, payload = {}) {
  console.warn('[LEGACY_READONLY_BLOCKED]', {
    component,
    action,
    payload,
    timestamp: new Date().toISOString()
  });
}