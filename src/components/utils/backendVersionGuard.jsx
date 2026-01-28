export const EXPECTED_BACKEND_VERSION = "2026-01-29";

export function warnIfBackendVersionMismatch(result, label = "Backend") {
  const v = result?.data?.version || result?.version;
  if (!v) return; // don't block if a function hasn't been updated yet
  if (v !== EXPECTED_BACKEND_VERSION) {
    console.warn(`[VersionMismatch] ${label} returned ${v} (expected ${EXPECTED_BACKEND_VERSION})`, result);
  }
}