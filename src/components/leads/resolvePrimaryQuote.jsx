/**
 * Lead Management Console - Primary Quote Resolver
 * 
 * This is a derived "primary quote" resolver for Lead Console read model.
 * It must remain deterministic and null-safe.
 * 
 * Selects the best quote for a project based on:
 * 1. Explicit project.primary_quote_id (if set and valid)
 * 2. Latest non-deleted quote by creation date
 * 
 * Returns a normalized snapshot for consumption by lead view model.
 */

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Safe array normalization
 * @param {any} v
 * @returns {Array}
 */
const safeArr = (v) => (Array.isArray(v) ? v : []);

/**
 * Safe string normalization
 * @param {any} v
 * @returns {string|null}
 */
const safeStr = (v) => (typeof v === "string" ? v : null);

/**
 * Safe number normalization
 * @param {any} v
 * @returns {number|null}
 */
const safeNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Safe ISO date string normalization
 * @param {any} v
 * @returns {string|null}
 */
const safeIso = (v) => (typeof v === "string" && v.length >= 10 ? v : null);

/**
 * Extract created date from quote (field name tolerance)
 * @param {Object} q
 * @returns {string|null}
 */
const quoteCreatedAt = (q) => {
  if (!q || typeof q !== "object") return null;
  return safeIso(q.created_date || q.created_at || q.createdAt);
};

/**
 * Check if quote is deleted
 * @param {Object} q
 * @returns {boolean}
 */
const isDeleted = (q) => {
  if (!q || typeof q !== "object") return false;
  
  // Check deleted flags
  if (q.deleted_at || q.is_deleted || q.isDeleted) {
    return true;
  }
  
  // Check status (case-insensitive)
  const status = safeStr(q.status);
  if (status && status.toLowerCase() === "deleted") {
    return true;
  }
  
  return false;
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Resolves the primary quote for a project.
 * 
 * Selection rules:
 * 1. If project.primary_quote_id exists and matches a non-deleted quote -> use it
 * 2. Else pick latest non-deleted quote by created_date
 * 3. If no quotes available -> return null
 * 
 * @param {Object|null} project - Project entity
 * @param {Array} quotesForProject - Array of Quote entities for this project
 * @returns {{id: string, project_id: string|null, status: string|null, value: number|null, created_at: string|null, raw: Object}|null}
 */
export const resolvePrimaryQuote = (project, quotesForProject = []) => {
  // Step 0: Null safety
  if (!project || typeof project !== "object") {
    return null;
  }

  // Step 1: Filter candidates (exclude deleted)
  const candidates = safeArr(quotesForProject).filter((q) => !isDeleted(q));
  
  if (candidates.length === 0) {
    return null;
  }

  // Step 2: Check if project has explicit primary_quote_id
  const primaryQuoteId = safeStr(project.primary_quote_id);
  if (primaryQuoteId) {
    const explicitPrimary = candidates.find((q) => safeStr(q.id) === primaryQuoteId);
    if (explicitPrimary) {
      return normalizeQuoteSnapshot(explicitPrimary);
    }
  }

  // Step 3: Pick latest by created date
  const sorted = [...candidates].sort((a, b) => {
    const aDate = quoteCreatedAt(a);
    const bDate = quoteCreatedAt(b);
    
    // Nulls last
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    
    // Descending (latest first)
    return bDate.localeCompare(aDate);
  });

  // If created dates are all null, try updated_date fallback
  if (!quoteCreatedAt(sorted[0])) {
    const sortedByUpdated = [...candidates].sort((a, b) => {
      const aUpdated = safeIso(a.updated_date || a.updated_at || a.updatedAt);
      const bUpdated = safeIso(b.updated_date || b.updated_at || b.updatedAt);
      
      if (!aUpdated && !bUpdated) return 0;
      if (!aUpdated) return 1;
      if (!bUpdated) return -1;
      
      return bUpdated.localeCompare(aUpdated);
    });
    
    if (safeIso(sortedByUpdated[0]?.updated_date || sortedByUpdated[0]?.updated_at || sortedByUpdated[0]?.updatedAt)) {
      return normalizeQuoteSnapshot(sortedByUpdated[0]);
    }
  }

  // Stable fallback: pick first from sorted (or last from original array)
  const chosen = sorted[0] || candidates[candidates.length - 1];
  return normalizeQuoteSnapshot(chosen);
};

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize quote to consistent snapshot shape
 * @param {Object|null} q
 * @returns {{id: string, project_id: string|null, status: string|null, value: number|null, created_at: string|null, raw: Object}|null}
 */
const normalizeQuoteSnapshot = (q) => {
  if (!q || typeof q !== "object") {
    return null;
  }

  const id = safeStr(q.id);
  if (!id) {
    return null; // ID is required
  }

  return {
    id,
    project_id: safeStr(q.project_id || q.projectId),
    status: safeStr(q.status),
    value: safeNum(q.value || q.total || q.total_value || q.quote_value),
    created_at: quoteCreatedAt(q),
    raw: q, // Keep reference to original quote
  };
};