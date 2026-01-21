/**
 * Part Status Transition Validation
 * GUARDRAIL: Prevents invalid status jumps (e.g., pending -> installed)
 */

import { PART_STATUS } from './constants.js';

// Valid transitions map: current_status -> [allowed_next_statuses]
const VALID_TRANSITIONS = {
  [PART_STATUS.PENDING]: [
    PART_STATUS.ON_ORDER,
    PART_STATUS.CANCELLED
  ],
  
  [PART_STATUS.ON_ORDER]: [
    PART_STATUS.IN_TRANSIT,
    PART_STATUS.AT_SUPPLIER,
    PART_STATUS.IN_LOADING_BAY,
    PART_STATUS.CANCELLED,
    PART_STATUS.PENDING // Allow reverting to pending if order cancelled
  ],
  
  [PART_STATUS.IN_TRANSIT]: [
    PART_STATUS.IN_LOADING_BAY,
    PART_STATUS.CANCELLED
  ],
  
  [PART_STATUS.IN_LOADING_BAY]: [
    PART_STATUS.IN_STORAGE,
    PART_STATUS.IN_TRANSIT // Allow moving back if sent to wrong location
  ],
  
  [PART_STATUS.AT_SUPPLIER]: [
    PART_STATUS.IN_STORAGE,
    PART_STATUS.IN_VEHICLE,
    PART_STATUS.CANCELLED
  ],
  
  [PART_STATUS.IN_STORAGE]: [
    PART_STATUS.IN_VEHICLE,
    PART_STATUS.INSTALLED,
    PART_STATUS.IN_LOADING_BAY // Allow moving back to loading bay
  ],
  
  [PART_STATUS.IN_VEHICLE]: [
    PART_STATUS.INSTALLED,
    PART_STATUS.IN_STORAGE // Allow returning to storage
  ],
  
  [PART_STATUS.INSTALLED]: [
    // Terminal state - no transitions allowed
  ],
  
  [PART_STATUS.CANCELLED]: [
    PART_STATUS.PENDING // Allow uncancelling
  ]
};

/**
 * Validate if transition from currentStatus to newStatus is allowed
 * @param {string} currentStatus - Current part status
 * @param {string} newStatus - Desired new status
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePartStatusTransition(currentStatus, newStatus) {
  // Allow setting status if current is null/undefined (new parts)
  if (!currentStatus) {
    return { valid: true };
  }

  // Allow keeping same status (no-op)
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition: ${currentStatus} -> ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`
    };
  }

  return { valid: true };
}

/**
 * Validate multiple status transitions at once
 * Used for batch operations
 */
export function validateBatchPartStatusTransitions(parts, newStatusMap) {
  const errors = [];
  
  for (const part of parts) {
    const newStatus = newStatusMap[part.id];
    if (!newStatus) continue;
    
    const validation = validatePartStatusTransition(part.status, newStatus);
    if (!validation.valid) {
      errors.push(`Part ${part.id}: ${validation.error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}