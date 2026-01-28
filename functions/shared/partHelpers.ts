
/**
 * Purchase Order helper functions for part operations
 * SINGLE SOURCE OF TRUTH for part status/location mapping
 */

import { PO_STATUS, PART_STATUS, PART_LOCATION } from './constants.js';

// Map PO status to corresponding Part status
export function mapPoStatusToPartStatus(poStatus) {
  switch (poStatus) {
    case PO_STATUS.DRAFT:
      return PART_STATUS.PENDING;
    case PO_STATUS.SENT:
    case PO_STATUS.ON_ORDER:
      return PART_STATUS.ON_ORDER;
    case PO_STATUS.IN_TRANSIT:
      return PART_STATUS.IN_TRANSIT;
    case PO_STATUS.IN_LOADING_BAY:
      return PART_STATUS.IN_LOADING_BAY;
    case PO_STATUS.AT_SUPPLIER:
      return PART_STATUS.AT_SUPPLIER;
    case PO_STATUS.IN_STORAGE:
      return PART_STATUS.IN_STORAGE;
    case PO_STATUS.IN_VEHICLE:
      return PART_STATUS.IN_VEHICLE;
    case PO_STATUS.INSTALLED:
      return PART_STATUS.INSTALLED;
    case PO_STATUS.CANCELLED:
      return PART_STATUS.CANCELLED;
    default:
      return PART_STATUS.PENDING;
  }
}

// Validate part status transitions
export function validatePartStatusTransition(oldStatus, newStatus) {
  // Allow any transition for now - add restrictions later if needed
  return { valid: true };
}

// Link parts to a purchase order
export async function linkPartsToPO(base44, poId, lineItems) {
  if (!lineItems || lineItems.length === 0) {
    return;
  }

  for (const item of lineItems) {
    if (item.part_id) {
      try {
        await base44.asServiceRole.entities.Part.update(item.part_id, {
          purchase_order_id: poId,
          purchase_order_ids: [poId],
          primary_purchase_order_id: poId,
        });
      } catch (err) {
        console.error(`Failed to link part ${item.part_id} to PO ${poId}:`, err);
      }
    }
  }
}

export * from "./partHelpers.ts";
