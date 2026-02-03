/**
 * Logistics Intent Key Helpers (S5.0)
 * 
 * Provides idempotency key generation for LogisticsRun creation.
 * Used to ensure duplicate run creation is prevented via get-or-create pattern.
 */

/**
 * Sort IDs deterministically for consistent hashing
 */
export function stableSortedIds(ids: string[]): string[] {
  return [...ids].sort();
}

/**
 * Create a lightweight deterministic hash from IDs
 * Uses base64url encoding of joined IDs for simplicity
 */
export function hashIds(ids: string[]): string {
  const sorted = stableSortedIds(ids);
  const joined = sorted.join('|');
  
  // Simple base64url encoding (browser-safe, no crypto needed)
  if (typeof btoa !== 'undefined') {
    return btoa(joined)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  // Fallback for environments without btoa (shouldn't happen in browser)
  return Buffer.from(joined).toString('base64url');
}

/**
 * Build intent key for Loading Bay clear runs
 * Format: clear_loading_bay:{hash_of_receipt_ids}
 */
export function buildClearLoadingBayIntentKey(receiptIds: string[]): string {
  const hash = hashIds(receiptIds);
  return `clear_loading_bay:${hash}`;
}

/**
 * Build intent key for Parts allocation-based runs
 * Format: parts_allocations:{visitId}:{targetVehicleId}:{targetLocationId}:{hash_of_allocation_ids}
 */
export function buildPartsAllocationsIntentKey({
  visitId,
  targetVehicleId,
  targetLocationId,
  allocationIds
}: {
  visitId?: string;
  targetVehicleId?: string;
  targetLocationId?: string;
  allocationIds: string[];
}): string {
  const hash = hashIds(allocationIds);
  const visit = visitId || 'none';
  const vehicle = targetVehicleId || 'none';
  const location = targetLocationId || 'none';
  
  return `parts_allocations:${visit}:${vehicle}:${location}:${hash}`;
}