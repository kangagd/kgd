/**
 * INVOICE & QUOTE LINKING GUARDRAILS
 * 
 * CRITICAL RULES enforced across all linking/unlinking operations:
 * 
 * 1. ALL relationship arrays store STRING IDs ONLY
 *    - project.xero_invoices: string[]
 *    - project.quote_ids: string[]
 * 
 * 2. ALWAYS normalize arrays before comparison:
 *    const currentIds = (project.xero_invoices || []).map(String);
 * 
 * 3. ALWAYS use String() when comparing IDs:
 *    String(id1) === String(id2)
 * 
 * 4. NEVER use direct .includes(id) on raw arrays
 *    ❌ BAD:  project.xero_invoices.includes(invoiceId)
 *    ✅ GOOD: (project.xero_invoices || []).map(String).includes(String(invoiceId))
 * 
 * 5. Upsert pattern (linkXeroInvoice only):
 *    - If xero_invoice_id provided but entity not found
 *    - REQUIRE invoice_snapshot in payload
 *    - Create XeroInvoice entity from snapshot
 *    - Return 400 if snapshot missing
 * 
 * 6. Idempotency:
 *    - Check if ID already in array before adding
 *    - Check if ID in array before removing
 *    - No duplicate entries allowed
 * 
 * 7. Unlink from old project:
 *    - Always check if linked to different project
 *    - Remove from old project's array before adding to new
 *    - Use string comparison for safety
 * 
 * 8. Ghost link cleanup:
 *    - Scan for stale references in other projects
 *    - Use normalized string comparisons
 * 
 * 9. Error handling:
 *    - Continue linking even if unlink from old project fails
 *    - Log errors but don't block operation
 * 
 * FILES AFFECTED:
 * - functions/linkXeroInvoice.js
 * - functions/unlinkXeroInvoice.js
 * - functions/linkQuote.js
 * - functions/unlinkQuote.js
 * 
 * VALIDATION CHECKLIST:
 * ✓ Link new invoice (not in DB) → creates entity + links
 * ✓ Link existing invoice → links without duplication
 * ✓ Link same invoice twice → idempotent, no duplicates
 * ✓ Unlink invoice → removes from array
 * ✓ Relink to different project → unlinks old, links new
 * ✓ Same flows for quotes
 * 
 * COMMON ERRORS TO AVOID:
 * ❌ Mixing string and number IDs in arrays
 * ❌ Direct array.includes() without normalization
 * ❌ Missing invoice_snapshot when creating new invoice
 * ❌ Not checking if ID already exists before adding
 * ❌ Not handling old project unlink failures gracefully
 */

/**
 * Normalize ID array to strings (helper for validation)
 */
export function normalizeIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(String);
}

/**
 * Check if ID exists in normalized array
 */
export function idExistsInArray(arr, id) {
  const normalized = normalizeIdArray(arr);
  return normalized.includes(String(id));
}

/**
 * Add ID to array if not exists (idempotent)
 */
export function addIdToArray(arr, id) {
  const normalized = normalizeIdArray(arr);
  const idStr = String(id);
  return normalized.includes(idStr) ? normalized : [...normalized, idStr];
}

/**
 * Remove ID from array
 */
export function removeIdFromArray(arr, id) {
  const normalized = normalizeIdArray(arr);
  return normalized.filter(existingId => String(existingId) !== String(id));
}

/**
 * Validate invoice snapshot has required fields
 */
export function validateInvoiceSnapshot(snapshot) {
  if (!snapshot) {
    return { valid: false, error: 'invoice_snapshot is required when creating new invoice' };
  }
  
  const required = ['xero_invoice_id', 'status'];
  const missing = required.filter(field => !snapshot[field]);
  
  if (missing.length > 0) {
    return { 
      valid: false, 
      error: `invoice_snapshot missing required fields: ${missing.join(', ')}` 
    };
  }
  
  return { valid: true };
}