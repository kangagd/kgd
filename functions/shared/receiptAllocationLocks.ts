/**
 * State Lock Guards for Receipts, ReceiptLines, and StockAllocations
 * 
 * Prevents mutations on entities that have been cleared, consumed, or released.
 * Used by frontend mutations and backend functions to enforce data integrity.
 */

// ============================================================================
// RECEIPT LOCKS
// ============================================================================

/**
 * Determine if a Receipt is immutable (locked)
 */
export function isReceiptLocked(receipt: any): boolean {
  if (!receipt) return false;
  
  return (
    receipt.status === 'cleared' ||
    !!receipt.cleared_at ||
    !!receipt.moved_out_at
  );
}

/**
 * Get allowed fields for updating a locked receipt
 */
export function getReceiptAllowedFields(receipt: any): string[] {
  if (!isReceiptLocked(receipt)) {
    return []; // All fields allowed
  }
  
  // Only these fields can be updated when locked
  return [
    'notes',
    'photos_json',
    'updated_by',
    'updated_at'
  ];
}

/**
 * Validate receipt update against lock rules
 * @returns null if valid, error message if invalid
 */
export function validateReceiptUpdate(receipt: any, updates: any): string | null {
  if (!isReceiptLocked(receipt)) {
    return null; // Not locked, all updates allowed
  }
  
  const allowedFields = getReceiptAllowedFields(receipt);
  const updateKeys = Object.keys(updates);
  const disallowedUpdates = updateKeys.filter(key => !allowedFields.includes(key));
  
  if (disallowedUpdates.length > 0) {
    return `Receipt is locked (cleared). Cannot update: ${disallowedUpdates.join(', ')}`;
  }
  
  return null;
}

// ============================================================================
// RECEIPT LINE LOCKS
// ============================================================================

/**
 * Determine if a ReceiptLine is immutable (locked)
 * A line is locked when its parent receipt is locked
 */
export function isReceiptLineLocked(receiptLine: any, parentReceipt: any): boolean {
  if (!parentReceipt) {
    // If we don't have parent context, be conservative
    return false;
  }
  
  return isReceiptLocked(parentReceipt);
}

/**
 * Get allowed fields for updating a locked receipt line
 */
export function getReceiptLineAllowedFields(receiptLine: any, parentReceipt: any): string[] {
  if (!isReceiptLineLocked(receiptLine, parentReceipt)) {
    return []; // All fields allowed
  }
  
  // Only these fields can be updated when locked
  return [
    'notes',
    'updated_by',
    'updated_at'
  ];
}

/**
 * Validate receipt line update against lock rules
 * @returns null if valid, error message if invalid
 */
export function validateReceiptLineUpdate(
  receiptLine: any,
  parentReceipt: any,
  updates: any
): string | null {
  if (!isReceiptLineLocked(receiptLine, parentReceipt)) {
    return null; // Not locked, all updates allowed
  }
  
  const allowedFields = getReceiptLineAllowedFields(receiptLine, parentReceipt);
  const updateKeys = Object.keys(updates);
  const disallowedUpdates = updateKeys.filter(key => !allowedFields.includes(key));
  
  if (disallowedUpdates.length > 0) {
    return `Receipt line is locked (parent receipt cleared). Cannot update: ${disallowedUpdates.join(', ')}`;
  }
  
  return null;
}

// ============================================================================
// STOCK ALLOCATION LOCKS
// ============================================================================

type AllocationStatus = 'reserved' | 'loaded' | 'consumed' | 'released';

/**
 * Define allowed status transitions for StockAllocation
 */
const ALLOWED_TRANSITIONS: Record<AllocationStatus, AllocationStatus[]> = {
  reserved: ['loaded', 'released'],
  loaded: ['consumed', 'released'], // Allow release from loaded for now
  consumed: [], // Terminal state
  released: [] // Terminal state
};

/**
 * Check if a status transition is allowed
 */
export function isAllocationTransitionAllowed(
  currentStatus: AllocationStatus,
  newStatus: AllocationStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

/**
 * Determine if a StockAllocation is in a terminal (locked) state
 */
export function isAllocationLocked(allocation: any): boolean {
  if (!allocation) return false;
  
  return (
    allocation.status === 'consumed' ||
    allocation.status === 'released'
  );
}

/**
 * Get allowed fields for updating a locked allocation
 */
export function getAllocationAllowedFields(allocation: any): string[] {
  if (!isAllocationLocked(allocation)) {
    return []; // All fields allowed
  }
  
  // Only these fields can be updated when locked
  return [
    'notes',
    'updated_by',
    'updated_at'
  ];
}

/**
 * Validate allocation update against lock rules
 * @returns null if valid, error message if invalid
 */
export function validateAllocationUpdate(allocation: any, updates: any): string | null {
  if (!allocation) {
    return 'Allocation not found';
  }
  
  // Check status transition if status is being changed
  if (updates.status && updates.status !== allocation.status) {
    if (!isAllocationTransitionAllowed(allocation.status, updates.status)) {
      const allowed = ALLOWED_TRANSITIONS[allocation.status] || [];
      return `Invalid status transition: ${allocation.status} → ${updates.status}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`;
    }
  }
  
  // Check field-level locks
  if (isAllocationLocked(allocation)) {
    const allowedFields = getAllocationAllowedFields(allocation);
    const updateKeys = Object.keys(updates);
    const disallowedUpdates = updateKeys.filter(key => !allowedFields.includes(key));
    
    if (disallowedUpdates.length > 0) {
      return `Allocation is locked (${allocation.status}). Cannot update: ${disallowedUpdates.join(', ')}`;
    }
  }
  
  return null;
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Format a user-friendly error message for UI display
 */
export function formatLockErrorForUI(entityType: 'receipt' | 'receiptLine' | 'allocation', reason: string): string {
  const entity = {
    receipt: 'receipt',
    receiptLine: 'receipt line',
    allocation: 'allocation'
  }[entityType];
  
  if (reason.includes('cleared')) {
    return `This ${entity} is locked because it has already been cleared.`;
  }
  
  if (reason.includes('consumed')) {
    return `This ${entity} is locked because it has already been consumed.`;
  }
  
  if (reason.includes('released')) {
    return `This ${entity} is locked because it has already been released.`;
  }
  
  // Generic fallback
  return `This ${entity} cannot be modified: ${reason}`;
}

/**
 * Check if an entity is legacy (pre-V2 model) and should bypass locks
 */
export function isLegacyEntity(entity: any): boolean {
  // Legacy entities don't have certain V2-specific fields
  // This allows legacy jobs/receipts to remain untouched
  return !!entity.legacy_flag || entity.write_source === 'migration';
}