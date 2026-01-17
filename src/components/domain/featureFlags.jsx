// Feature Flags Configuration
// GUARDRAIL: All flags default to false to prevent accidental activation

export const FEATURE_FLAGS = {
  // Visit Model: Switch execution tracking from Job to Visit entity
  // When enabled: UI reads work_performed, photos, measurements from Visit instead of Job
  // When disabled: Legacy Job-based UI (default)
  visits_enabled: false,
  
  // Model Health: Enable commit fixes on Model Health admin page
  // When enabled: Allows committing drift fixes (dry run always available)
  // When disabled: Only dry run analysis allowed
  model_health_fixes: false,
};

// Helper to check if a feature is enabled
export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true;
}