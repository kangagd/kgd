/**
 * Parts Status Computation Utility
 * 
 * Pure mapping utility for computing parts status metrics from parts, purchase orders, and logistics data.
 * Does not modify schemas or business logic - only computes display metrics.
 */

import { normalizeStatus } from './statusRegistry';
import { getPoEta, safeParseDate } from './schemaAdapters';
import { getNormalizedPartStatus, PART_STATUS } from './partConfig';

// Whitelist of statuses that indicate a part is READY
const READY_STATUSES = new Set([
  'ready',
  'received',
  'in_stock',
  'in_storage',
  'instorage', // Handle potential spacing issues
  'reserved',
  'allocated',
  'in_vehicle',
  'invehicle', // Handle potential spacing issues
  'in_car',
  'picked',
  'available',
  'installed',
  'in_loading_bay',
  'inloadingbay' // Handle potential spacing issues
]);

// Whitelist of locations that indicate a part is READY
const READY_LOCATIONS = new Set([
  'storage',
  'vehicle',
  'site',
  'warehouse_storage',
  'delivery_bay'
]);

// Whitelist of statuses that indicate a part is ORDERED
const ORDERED_STATUSES = new Set([
  'ordered',
  'on_order',
  'po_created',
  'po_sent',
  'supplier_confirmed',
  'in_transit',
  'shipping',
  'backorder',
  'awaiting_stock'
]);

// PO statuses that are considered "open"
const OPEN_PO_STATUSES = new Set([
  'draft',
  'sent',
  'ordered',
  'confirmed',
  'partially_received',
  'in_transit',
  'ready_for_pickup'
]);

// PO statuses that are considered "closed"
const CLOSED_PO_STATUSES = new Set([
  'received',
  'completed',
  'closed',
  'cancelled'
]);

/**
 * Determine if a part is READY based on normalized status (which includes PO promotion)
 */
function isPartReady(part) {
  // Use the normalized status which includes PO status promotion
  const status = getNormalizedPartStatus(part);
  
  // CRITICAL: Parts with these statuses are READY
  if (status === PART_STATUS.IN_STORAGE || 
      status === PART_STATUS.IN_LOADING_BAY || 
      status === PART_STATUS.IN_VEHICLE ||
      status === PART_STATUS.INSTALLED) {
    return true;
  }
  
  // Check received quantity
  const receivedQty = Number(part.received_qty || part.quantity_received || 0);
  if (receivedQty > 0) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a part is ORDERED based on normalized status (which includes PO promotion)
 */
function isPartOrdered(part, purchaseOrders) {
  // Use the normalized status which includes PO status promotion
  const status = getNormalizedPartStatus(part);
  
  // Check if status indicates ordered state
  if (status === PART_STATUS.ON_ORDER || 
      status === PART_STATUS.IN_TRANSIT) {
    return true;
  }
  
  // Check if linked to a PO
  const hasPoLink = Boolean(
    part.purchase_order_id ||
    part.linked_po_id ||
    part.po_id ||
    part.purchase_order_line_id
  );
  
  if (hasPoLink) {
    return true;
  }
  
  return false;
}

/**
 * Compute parts status metrics
 * 
 * @param {Object} params
 * @param {Array} params.parts - Array of part objects
 * @param {Array} params.purchaseOrders - Array of purchase order objects
 * @param {Array} params.logisticsJobs - Array of logistics job objects (optional)
 * @returns {Object} Status metrics
 */
export function computePartsStatus({ parts = [], purchaseOrders = [], logisticsJobs = [] }) {
  let requiredCount = 0;
  let readyCount = 0;
  let orderedCount = 0;
  let missingCount = 0;
  
  // Process each part with precedence: READY > ORDERED > MISSING
  for (const part of parts) {
    const requiredQty = Number(part.quantity_required || part.required_qty || part.quantity || 1);
    const receivedQty = Number(part.received_qty || part.quantity_received || 0);
    
    requiredCount += requiredQty;
    
    // Check READY first (highest precedence)
    if (isPartReady(part)) {
      // If part is ready, assume full quantity is ready
      // (receivedQty is used only if it's explicitly tracked and less than required)
      const readyQty = receivedQty > 0 ? Math.min(receivedQty, requiredQty) : requiredQty;
      readyCount += readyQty;
      
      // If not fully received, remainder could be ordered or missing
      const remainingQty = Math.max(requiredQty - readyQty, 0);
      if (remainingQty > 0) {
        if (isPartOrdered(part, purchaseOrders)) {
          orderedCount += remainingQty;
        } else {
          missingCount += remainingQty;
        }
      }
    }
    // Check ORDERED (second precedence)
    else if (isPartOrdered(part, purchaseOrders)) {
      const orderedQty = Math.max(requiredQty - receivedQty, 0);
      orderedCount += orderedQty;
    }
    // MISSING (fallback)
    else {
      const missingQty = Math.max(requiredQty - receivedQty, 0);
      missingCount += missingQty;
    }
  }
  
  // Compute PO metrics
  let openPOCount = 0;
  let overduePOCount = 0;
  
  // Statuses that should not count as overdue (already received/delivered)
  const RECEIVED_PO_STATUSES = new Set([
    'received',
    'in_storage',
    'in_loading_bay',
    'in_vehicle',
    'installed',
    'completed',
    'closed'
  ]);
  
  if (purchaseOrders && purchaseOrders.length > 0) {
    const now = new Date();
    
    for (const po of purchaseOrders) {
      const poStatus = normalizeStatus(po.status);
      
      // Check if PO is open
      const isOpen = !CLOSED_PO_STATUSES.has(poStatus);
      
      if (isOpen) {
        openPOCount++;
        
        // Only check overdue if PO hasn't been received yet
        if (!RECEIVED_PO_STATUSES.has(poStatus)) {
          const etaValue = getPoEta(po);
          if (etaValue) {
            const etaDate = safeParseDate(etaValue);
            if (etaDate && etaDate < now) {
              overduePOCount++;
            }
          }
        }
      }
    }
  }
  
  // Compute readiness flag - all required parts must be ready
  const partsReady = requiredCount > 0 && readyCount >= requiredCount;
  
  return {
    requiredCount,
    readyCount,
    orderedCount,
    missingCount,
    partsReady,
    openPOCount,
    overduePOCount
  };
}

export default computePartsStatus;