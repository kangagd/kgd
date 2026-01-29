/**
 * Discovery Layer Gating Logic
 * 
 * Centralized module for controlling access to discovery features.
 * No other file should re-implement this logic.
 */

// Constants
const DISCOVERY_FLAG_KEY = "kgd_ff_DISCOVERY_LAYER_V1";
const DISCOVERY_ALLOWED_EMAIL = "admin@kangaroogd.com.au";

/**
 * Normalize email string
 * @param {any} v - Email value to normalize
 * @returns {string} Lowercased, trimmed email
 */
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

/**
 * Check if user is allowlisted for discovery features
 * @param {object} user - Auth user object
 * @returns {boolean} True if user's email matches allowed email
 */
export function isDiscoveryAllowedUser(user) {
  if (!user) return false;

  // Extract email from user object (try multiple fields)
  const userEmail = 
    user.email ||
    user.primary_email ||
    user.login ||
    user.profile?.email;

  const normalized = normEmail(userEmail);
  return normalized === DISCOVERY_ALLOWED_EMAIL;
}

/**
 * Check if discovery flag is enabled in localStorage
 * @returns {boolean} True if flag is explicitly set to "1"
 */
export function isDiscoveryFlagEnabled() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false; // Server-side or no localStorage - default false
  }

  try {
    return localStorage.getItem(DISCOVERY_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Enable or disable discovery flag in localStorage
 * @param {boolean} enabled - Whether to enable the flag
 */
export function setDiscoveryFlagEnabled(enabled) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return; // No-op on server-side
  }

  try {
    if (enabled) {
      localStorage.setItem(DISCOVERY_FLAG_KEY, "1");
    } else {
      localStorage.removeItem(DISCOVERY_FLAG_KEY);
    }
  } catch (error) {
    console.error('[discoveryGate] Failed to set flag:', error);
  }
}

/**
 * Check if discovery features should be enabled
 * Requires BOTH user allowlist AND flag enabled
 * @param {object} user - Auth user object
 * @returns {boolean} True only if user is allowed AND flag is enabled
 */
export function isDiscoveryEnabled(user) {
  return isDiscoveryAllowedUser(user) && isDiscoveryFlagEnabled();
}