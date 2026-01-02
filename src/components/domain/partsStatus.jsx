/**
 * Parts Status Computation Utility
 * 
 * Pure mapping utility for computing parts status metrics from parts, purchase orders, and logistics data.
 * Does not modify schemas or business logic - only computes display metrics.
 */

import { normalizeStatus } from './statusRegistry';
import { getPoEta, safeParseDate } from './schemaAdapters';

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
 * Determine if a part is READY based on status, location, and received quantity
 */
function isPartReady(part) {
  // Handle potential field name variations (status or part_status)
  const statusValue = part.status || part.part_status || '';
  const normalizedStatus = normalizeStatus(statusValue);
  const normalizedLocation = normalizeStatus(part.location);
  const receivedQty = Number(part.received_qty || part.quantity_received || 0);
  
  // CRITICAL: Parts with in_storage, in_loading_bay, or in_vehicle status are READY
  // These statuses inherently mean the part is physically available (not at supplier)
  if (normalizedStatus === 'in_storage' || 
      normalizedStatus === 'in_loading_bay' || 
      normalizedStatus === 'in_vehicle') {
    return true;
  }
  
  // Check status whitelist
  if (READY_STATUSES.has(normalizedStatus)) {
    return true;
  }
  
  // Check location whitelist (but only if status is not already conclusive)
  if (normalizedLocation && normalizedLocation !== 'supplier' && READY_LOCATIONS.has(normalizedLocation)) {
    return true;
  }
  
  // Check received quantity
  if (receivedQty > 0) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a part is ORDERED based on status and PO linkage
 */
function isPartOrdered(part, purchaseOrders) {
  const normalizedStatus = normalizeStatus(part.status);
  
  // Check status whitelist
  if (ORDERED_STATUSES.has(normalizedStatus)) {
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
  
  // Check if matched to an open PO
  if (purchaseOrders && purchaseOrders.length > 0) {
    const openPOs = purchaseOrders.filter(po => {
      const poStatus = normalizeStatus(po.status);
      return !CLOSED_PO_STATUSES.has(poStatus);
    });
    
    // If part has supplier_id matching an open PO
    if (part.supplier_id && openPOs.some(po => po.supplier_id === part.supplier_id)) {
      return true;
    }
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
  
  if (purchaseOrders && purchaseOrders.length > 0) {
    const now = new Date();
    
    for (const po of purchaseOrders) {
      const poStatus = normalizeStatus(po.status);
      
      // Check if PO is open
      const isOpen = !CLOSED_PO_STATUSES.has(poStatus);
      
      if (isOpen) {
        openPOCount++;
        
        // Check if overdue using schemaAdapters
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