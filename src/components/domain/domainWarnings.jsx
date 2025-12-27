/**
 * Domain Warnings Utility
 * 
 * REMOVED: All PO-related warnings (HARD RESET - 2025-12-27)
 * 
 * Provides lightweight, non-blocking runtime warnings for data inconsistencies.
 * Warnings are deduplicated to avoid console spam.
 */

// Deduplication tracking
const warnedItems = new Set();

/**
 * Warn once per unique key
 */
function warnOnce(key, message) {
  if (!warnedItems.has(key)) {
    console.warn(message);
    warnedItems.add(key);
  }
}

/**
 * Clear all warning history (useful for testing/dev)
 */
export function clearWarnings() {
  warnedItems.clear();
}