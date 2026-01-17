// Feature Flags Configuration
// GUARDRAIL: All flags default to false to prevent accidental activation

export const FEATURE_FLAGS = {
  // Visit Model: Switch execution tracking from Job to Visit entity
  // When enabled: UI reads work_performed, photos, measurements from Visit instead of Job
  // When disabled: Legacy Job-based UI (default)
  visits_enabled: false,
};

// Helper to check if a feature is enabled
export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true;
}