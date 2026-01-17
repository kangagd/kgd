/**
 * Email Pipeline Feature Flags
 * Centralized runtime-toggleable gates for safe rollouts
 * Default: ON in staging, OFF in prod (enable gradually)
 */

const FEATURE_FLAGS = {
  // Decoding: Use base64url padding + consistent decoding
  EMAIL_DECODE_V2: process.env.REACT_APP_EMAIL_DECODE_V2 !== 'false', // Default ON
  
  // Threading: Gmail threadId only; Wix special-casing
  EMAIL_THREADING_V2: process.env.REACT_APP_EMAIL_THREADING_V2 !== 'false', // Default ON
  
  // Composer: Merge render at send + signature parity
  EMAIL_COMPOSER_V2: process.env.REACT_APP_EMAIL_COMPOSER_V2 !== 'false', // Default ON
  
  // Inline CID: CID-only resolver + mapping normalization
  EMAIL_INLINE_CID_V2: process.env.REACT_APP_EMAIL_INLINE_CID_V2 !== 'false', // Default ON
  
  // Sent Sync: Optimistic write or immediate thread sync
  EMAIL_SENT_SYNC_V2: process.env.REACT_APP_EMAIL_SENT_SYNC_V2 !== 'false', // Default ON
  
  // Debug mode: Structured logging
  EMAIL_DEBUG: process.env.REACT_APP_EMAIL_DEBUG === 'true', // Default OFF
};

export function getFeatureFlag(flagName) {
  return FEATURE_FLAGS[flagName] ?? false;
}

export function setFeatureFlag(flagName, value) {
  if (flagName in FEATURE_FLAGS) {
    FEATURE_FLAGS[flagName] = value;
    if (FEATURE_FLAGS.EMAIL_DEBUG) {
      console.log(`[Email] Feature flag ${flagName} = ${value}`);
    }
  }
}

export function getAllFeatureFlags() {
  return { ...FEATURE_FLAGS };
}

export function logEmailEvent(phase, data) {
  if (FEATURE_FLAGS.EMAIL_DEBUG) {
    console.log(`[Email:${phase}]`, data);
  }
}