/**
 * Dev-only audit to detect hardcoded project query keys that bypass helpers.
 * Warns if cache keys diverge from expected helper-based patterns.
 * 
 * DEV ONLY — does not run in production builds.
 */

const EXPECTED_KEY_PATTERNS = {
  // Must use projectKeys.list()
  list: () => ["projects", "list"],
  
  // Must use projectKeys.withRelations(projectId, tab)
  withRelations: (projectId, tab) => ["projects", "withRelations", projectId, tab || "all"],
  
  // Must use projectKeys.drafts(projectId)
  drafts: (projectId) => ["projects", "drafts", projectId],
};

const FLAGGED_HARDCODED_PATTERNS = [
  // Hardcoded drafts (should use projectKeys.drafts)
  { pattern: /\['projectWithRelations'.*'drafts'\]/g, hint: "Use projectKeys.drafts(projectId)" },
  { pattern: /\["projects".*"drafts"/g, hint: "Use projectKeys.drafts(projectId)" },
  
  // Hardcoded list (should use projectKeys.list)
  { pattern: /\['projects',\s*'list'\]/g, hint: "Use projectKeys.list()" },
];

/**
 * Validate that projectKeys helper outputs match expected patterns.
 * Called once on ProjectDetails mount in dev mode.
 * 
 * @param {Object} projectKeys - The projectKeys helper object
 * @param {string} projectId - Project ID for testing helpers
 */
export function assertProjectQueryKeysAreHelperBased(projectKeys, projectId = "test-id") {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) {
    return; // Skip in production
  }

  const mismatches = [];

  // Validate list() output
  const listKey = projectKeys.list?.();
  const expectedList = EXPECTED_KEY_PATTERNS.list();
  if (JSON.stringify(listKey) !== JSON.stringify(expectedList)) {
    mismatches.push({
      helper: "projectKeys.list()",
      expected: expectedList,
      actual: listKey,
    });
  }

  // Validate withRelations() output
  const withRelKey = projectKeys.withRelations?.(projectId, "overview");
  const expectedWithRel = EXPECTED_KEY_PATTERNS.withRelations(projectId, "overview");
  if (JSON.stringify(withRelKey) !== JSON.stringify(expectedWithRel)) {
    mismatches.push({
      helper: "projectKeys.withRelations(projectId, tab)",
      expected: expectedWithRel,
      actual: withRelKey,
    });
  }

  // Validate drafts() output
  const draftsKey = projectKeys.drafts?.(projectId);
  const expectedDrafts = EXPECTED_KEY_PATTERNS.drafts(projectId);
  if (JSON.stringify(draftsKey) !== JSON.stringify(expectedDrafts)) {
    mismatches.push({
      helper: "projectKeys.drafts(projectId)",
      expected: expectedDrafts,
      actual: draftsKey,
    });
  }

  // Log warnings if any mismatches found
  if (mismatches.length > 0) {
    console.warn(
      "[ProjectKeysAudit] Query key structure mismatch detected. Helpers may have drifted:",
      mismatches
    );
  }
}

/**
 * Detects common hardcoded query key patterns that should use helpers.
 * Useful for grep/code review to catch regressions.
 * 
 * @returns {Object} Object mapping pattern description to detection function
 */
export function getHardcodedKeyDetectors() {
  return {
    hardcodedDrafts: () => /\['projectWithRelations',\s*[^,]+,\s*'drafts'\]|\["projects",\s*"drafts"/,
    hardcodedListKey: () => /\['projects',\s*'list'\]|\["projects",\s*"list"\]/,
    hardcodedWithRelations: () => /\['projects',\s*'withRelations',\s*[^,]+,\s*[^]]+\]/,
  };
}

/**
 * Human-readable audit report for developers.
 * Log this to console to see expected vs actual helper patterns.
 */
export function logProjectKeysAuditReport(projectKeys, projectId = "5000") {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) {
    return;
  }

  console.group("[ProjectKeysAudit] Helper Output Report");
  console.log("projectKeys.list():", projectKeys.list?.());
  console.log("projectKeys.detail(projectId):", projectKeys.detail?.(projectId));
  console.log("projectKeys.withRelations(projectId, 'overview'):", projectKeys.withRelations?.(projectId, "overview"));
  console.log("projectKeys.drafts(projectId):", projectKeys.drafts?.(projectId));
  console.groupEnd();
}