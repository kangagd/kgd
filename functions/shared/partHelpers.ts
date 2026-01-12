/**
 * Part management helper functions
 * SINGLE SOURCE OF TRUTH for Part operations
 */

import { PART_STATUS, PART_LOCATION, PO_STATUS } from './constants.js';

// Map PO status to Part status
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
            return PART_STATUS.PENDING;
        
        default:
            return PART_STATUS.PENDING;
    }
}

// Determine Part status from target location
export function determinePartStatus(toLocation) {
    switch (toLocation) {
        case PART_LOCATION.LOADING_BAY:
            return PART_STATUS.IN_LOADING_BAY;
        case PART_LOCATION.WAREHOUSE_STORAGE:
            return PART_STATUS.IN_STORAGE;
        case PART_LOCATION.VEHICLE:
            return PART_STATUS.IN_VEHICLE;
        case PART_LOCATION.CLIENT_SITE:
            return PART_STATUS.INSTALLED;
        default:
            return null;
    }
}

// Link Parts to Purchase Order
// GUARDRAIL: If part already has a primary PO, add to array but don't overwrite primary
export async function linkPartsToPO(base44, purchaseOrderId, lineItems) {
    const today = new Date().toISOString().split('T')[0];
    const partIds = lineItems.map(item => item.part_id).filter(Boolean);
    
    if (partIds.length === 0) return;

    const uniquePartIds = [...new Set(partIds)];

    for (const partId of uniquePartIds) {
        try {
            const part = await base44.asServiceRole.entities.Part.get(partId);
            if (!part) continue;

            const updateData = {
                last_synced_from_po_at: new Date().toISOString(),
                synced_by: 'system:linkPartsToPO'
            };

            // Build purchase_order_ids array
            const existingPoIds = part.purchase_order_ids || [];
            if (part.purchase_order_id && !existingPoIds.includes(part.purchase_order_id)) {
                existingPoIds.push(part.purchase_order_id);
            }
            
            // Add new PO if not already in array
            if (!existingPoIds.includes(purchaseOrderId)) {
                existingPoIds.push(purchaseOrderId);
            }
            
            updateData.purchase_order_ids = existingPoIds;

            // Set primary_purchase_order_id only if part doesn't already have one
            if (!part.primary_purchase_order_id) {
                updateData.primary_purchase_order_id = purchaseOrderId;
            } else if (part.primary_purchase_order_id !== purchaseOrderId) {
                // Part already has a different primary PO - log warning but don't overwrite
                console.warn(`[linkPartsToPO] Part ${partId} already has primary PO ${part.primary_purchase_order_id}, adding ${purchaseOrderId} to array only`);
            }

            // Update status if currently pending
            if (part.status === PART_STATUS.PENDING || part.status === "Pending") {
                updateData.status = PART_STATUS.ON_ORDER;
            }

            if (!part.order_date) {
                updateData.order_date = today;
            }

            if (!part.location) {
                updateData.location = PART_LOCATION.SUPPLIER;
            }

            // For backward compat, keep purchase_order_id in sync with primary
            if (updateData.primary_purchase_order_id) {
                updateData.purchase_order_id = updateData.primary_purchase_order_id;
            }

            await base44.asServiceRole.entities.Part.update(partId, updateData);
            console.log(`[linkPartsToPO] Linked part ${partId} to PO ${purchaseOrderId} (primary=${updateData.primary_purchase_order_id})`);
        } catch (error) {
            console.error(`Error linking part ${partId} to PO ${purchaseOrderId}:`, error);
        }
    }
}