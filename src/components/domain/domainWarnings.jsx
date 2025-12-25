/**
 * Domain Warnings Utility
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
 * Warn if PO has both expected_date and eta but they disagree
 */
export function warnPoEtaMismatch(po) {
  if (!po?.id) return;
  
  const expected = po.expected_date;
  const eta = po.eta;
  
  if (expected && eta && expected !== eta) {
    warnOnce(
      `po-eta-mismatch-${po.id}`,
      `[PO ${po.id}] ETA fields disagree: expected_date="${expected}", eta="${eta}"`
    );
  }
}

/**
 * Warn if PO has no supplier_id and no supplier_name
 */
export function warnPoMissingSupplier(po) {
  if (!po?.id) return;
  
  if (!po.supplier_id && !po.supplier_name) {
    warnOnce(
      `po-missing-supplier-${po.id}`,
      `[PO ${po.id}] Missing both supplier_id and supplier_name`
    );
  }
}

/**
 * Warn if unknown PO status appears
 */
export function warnUnknownPoStatus(status, knownStatuses) {
  if (!status) return;
  
  const normalized = typeof status === 'string' 
    ? status.toLowerCase().trim().replace(/[\s-]/g, '_') 
    : '';
  
  if (normalized && !knownStatuses.has(normalized)) {
    warnOnce(
      `unknown-po-status-${normalized}`,
      `[PO Status] Unknown status encountered: "${status}" (normalized: "${normalized}")`
    );
  }
}

/**
 * Clear all warning history (useful for testing/dev)
 */
export function clearWarnings() {
  warnedItems.clear();
}