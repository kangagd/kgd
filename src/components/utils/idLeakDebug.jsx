/**
 * ID Leak Debug Mode - Admin-only temporary debug tool
 * Shows which labels are actually raw IDs instead of resolved names
 */

// Toggle: Set to true to enable red ID badges on any rendered ID
export const DEBUG_SHOW_RAW_IDS = false;

/**
 * Check if a string looks like a Base44 object ID
 * Returns true if:
 * - 24 hex characters (e.g., 507f1f77bcf86cd799439011)
 * - Matches the ID pattern
 */
export function isIdLike(str) {
  if (!str || typeof str !== 'string') return false;
  
  // Check for 24 hex characters
  if (/^[a-f0-9]{24}$/i.test(str)) return true;
  
  // Check if it contains _id pattern (e.g., in JSON stringified objects)
  if (str.includes('_id')) return true;
  
  return false;
}

/**
 * Log ID leak to console (with component context)
 * Called from IdLeakBadge for visibility
 */
export function logIdLeak(componentName, fieldName, rawId) {
  if (DEBUG_SHOW_RAW_IDS) {
    console.warn(
      `%c[ID LEAK] %c${componentName} - ${fieldName}: ${rawId}`,
      'background: #DC2626; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
      'color: #DC2626; font-family: monospace;'
    );
  }
}