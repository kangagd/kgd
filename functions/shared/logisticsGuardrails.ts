/**
 * NO REGRESSION Guardrails for Logistics & Stock Processing
 * 
 * Core Rules (non-negotiables):
 * 1. Once logistics, always logistics (is_logistics_job: true cannot revert to false)
 * 2. Purpose never null (always valid code or 'other')
 * 3. Project cached fields fill-only (never clear)
 * 4. Stock transfer status: default 'draft', cannot downgrade from 'completed'
 * 5. Backfills repair only, never rewrite
 */

const VALID_LOGISTICS_PURPOSES = [
  'po_delivery_to_warehouse',
  'po_pickup_from_supplier',
  'part_pickup_for_install',
  'manual_client_dropoff',
  'sample_dropoff',
  'sample_pickup',
  'other'
];

const STOCK_TRANSFER_STATUS_HIERARCHY = {
  'draft': 0,
  'not_started': 0,
  'pending': 1,
  'completed': 2,
  'skipped': 1
};

/**
 * Determines if a job indicates logistics based on multiple signals
 */
function indicatesLogistics(job) {
  if (job?.is_logistics_job === true) return true;
  if (job?.purchase_order_id) return true;
  if (job?.vehicle_id) return true;
  if (job?.third_party_trade_id) return true;
  if (job?.origin_address || job?.destination_address) return true;
  
  const purpose = normalizePurpose(job?.logistics_purpose || job?.logisticsPurpose);
  if (purpose && purpose !== 'other') return true;
  
  return false;
}

/**
 * Normalize logistics_purpose from any representation
 * Returns valid code or 'other', never null
 */
function normalizePurpose(input) {
  if (!input) return 'other';
  
  const raw = String(input).toLowerCase().trim();
  
  // Direct match
  if (VALID_LOGISTICS_PURPOSES.includes(raw)) {
    return raw;
  }
  
  // Purpose code to full name mapping
  const codeMap = {
    'po-del': 'po_delivery_to_warehouse',
    'po-pu': 'po_pickup_from_supplier',
    'part-pu': 'part_pickup_for_install',
    'drop': 'manual_client_dropoff',
    'samp-do': 'sample_dropoff',
    'samp-pu': 'sample_pickup'
  };
  
  if (codeMap[raw]) return codeMap[raw];
  
  // Fuzzy match
  if (raw.includes('delivery') || raw.includes('po') && raw.includes('warehouse')) {
    return 'po_delivery_to_warehouse';
  }
  if (raw.includes('pickup') && raw.includes('supplier')) {
    return 'po_pickup_from_supplier';
  }
  if (raw.includes('pickup') && raw.includes('material')) {
    return 'part_pickup_for_install';
  }
  if (raw.includes('sample') && raw.includes('pickup')) {
    return 'sample_pickup';
  }
  if (raw.includes('sample') && (raw.includes('drop') || raw.includes('dropoff'))) {
    return 'sample_dropoff';
  }
  if (raw.includes('dropoff') || raw.includes('client')) {
    return 'manual_client_dropoff';
  }
  
  // Fallback: unknown/invalid values always become 'other'
  return 'other';
}

/**
 * CORE GUARDRAIL: Ensure Logistics Canonicalization
 * Applies all normalization and defaults before any write
 * 
 * @param {object} jobOrPatch - New/updated job data
 * @param {object} previousJob - Previous job state (for regression checks)
 * @returns {object} Normalized job data with all guardrails applied
 */
function ensureLogisticsCanon(jobOrPatch, previousJob = null) {
  if (!jobOrPatch || typeof jobOrPatch !== 'object') {
    return jobOrPatch;
  }
  
  const normalized = { ...jobOrPatch };
  const wasLogistics = previousJob?.is_logistics_job === true;
  
  // RULE 1: Once logistics, always logistics
  const isLogisticsNow = indicatesLogistics(normalized);
  if (wasLogistics || isLogisticsNow) {
    normalized.is_logistics_job = true;
    
    // RULE 2: Purpose never null
    if (!normalized.logistics_purpose || normalized.logistics_purpose === 'unknown') {
      const purpose = normalizePurpose(
        normalized.logistics_purpose || 
        normalized.logisticsPurpose || 
        normalized.logistics_purpose_raw ||
        previousJob?.logistics_purpose ||
        normalized.notes
      );
      normalized.logistics_purpose = purpose;
    }
    
    // RULE: Defaults for logistics jobs
    if (!normalized.logistics_outcome) {
      normalized.logistics_outcome = 'none';
    }
    if (!normalized.stock_transfer_status) {
      normalized.stock_transfer_status = 'draft';
    }
  }
  
  // RULE 3: Project cached fields fill-only
  if (normalized.project_id && !previousJob?.project_id) {
    // New project_id, will be populated by caller if needed
  } else if (normalized.project_id && previousJob?.project_id === normalized.project_id) {
    // Same project, preserve cached fields if they exist
    if (previousJob?.project_number && !normalized.project_number) {
      normalized.project_number = previousJob.project_number;
    }
    if (previousJob?.project_name && !normalized.project_name) {
      normalized.project_name = previousJob.project_name;
    }
  }
  
  // RULE 4: Stock transfer status hierarchy enforcement
  if (normalized.stock_transfer_status && previousJob?.stock_transfer_status) {
    const prevLevel = STOCK_TRANSFER_STATUS_HIERARCHY[previousJob.stock_transfer_status] ?? -1;
    const newLevel = STOCK_TRANSFER_STATUS_HIERARCHY[normalized.stock_transfer_status] ?? -1;
    
    // Cannot downgrade from completed
    if (prevLevel >= 2 && newLevel < 2) {
      normalized.stock_transfer_status = previousJob.stock_transfer_status;
    }
  }
  
  return normalized;
}

/**
 * SAFETY BLOCKER: Strip rollback attempts and log
 * Prevents regression by removing dangerous write attempts
 * 
 * @param {object} previousJob - Current job state in database
 * @param {object} patch - Attempted updates
 * @returns {object} Cleaned patch with rollback attempts removed
 */
function stripRollbackWrites(previousJob, patch) {
  if (!previousJob || !patch) return patch;
  
  const cleaned = { ...patch };
  const blocked = [];
  
  // BLOCK: is_logistics_job true → false
  if (previousJob.is_logistics_job === true && cleaned.is_logistics_job === false) {
    delete cleaned.is_logistics_job;
    blocked.push('is_logistics_job: true → false');
  }
  
  // BLOCK: logistics_purpose valid → null/unknown
  const prevPurpose = previousJob.logistics_purpose;
  const newPurpose = cleaned.logistics_purpose;
  if (prevPurpose && VALID_LOGISTICS_PURPOSES.includes(prevPurpose)) {
    if (!newPurpose || newPurpose === 'unknown' || newPurpose === null) {
      delete cleaned.logistics_purpose;
      blocked.push(`logistics_purpose: ${prevPurpose} → ${newPurpose}`);
    }
  }
  
  // BLOCK: project_number non-empty → null/empty
  if (previousJob.project_number && !cleaned.project_number) {
    delete cleaned.project_number;
    blocked.push(`project_number: ${previousJob.project_number} → null`);
  }
  
  // BLOCK: stock_transfer_status completed → downgrade
  if (previousJob.stock_transfer_status === 'completed') {
    const newStatus = cleaned.stock_transfer_status;
    if (newStatus && newStatus !== 'completed') {
      delete cleaned.stock_transfer_status;
      blocked.push(`stock_transfer_status: completed → ${newStatus}`);
    }
  }
  
  // LOG blocked attempts
  if (blocked.length > 0) {
    console.warn(`[NO_REGRESSION] Blocked rollback writes for job ${previousJob.id || 'unknown'}:`, blocked);
  }
  
  return cleaned;
}

/**
 * BACKFILL SAFETY: Only fill missing/invalid/legacy fields
 * Returns true if update should proceed, false if no changes needed
 * 
 * @param {object} current - Current database record
 * @param {string} fieldName - Field to potentially fill
 * @param {any} newValue - New value
 * @returns {boolean} True if field should be updated
 */
function shouldBackfillField(current, fieldName, newValue) {
  if (!newValue) return false;
  
  const existing = current[fieldName];
  
  // Missing: update
  if (existing === null || existing === undefined) return true;
  
  // Legacy values: update
  if (['unknown', 'null', '', 'N/A'].includes(existing)) return true;
  
  // Already has valid value: skip
  if (existing && existing !== 'unknown') return false;
  
  return true;
}

/**
 * Format blocked fields log for diagnostics
 */
function logBackfillSkips(jobId, skippedFields) {
  if (skippedFields.length === 0) return;
  console.info(
    `[NO_REGRESSION] Backfill skipped (already valid) for job ${jobId}:`,
    skippedFields
  );
}

module.exports = {
  ensureLogisticsCanon,
  stripRollbackWrites,
  shouldBackfillField,
  logBackfillSkips,
  indicatesLogistics,
  normalizePurpose,
  VALID_LOGISTICS_PURPOSES,
  STOCK_TRANSFER_STATUS_HIERARCHY
};