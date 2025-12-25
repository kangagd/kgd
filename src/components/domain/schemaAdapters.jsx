/**
 * Schema Adapters - Pure functions to standardize field access across entities
 * 
 * These adapters handle inconsistent field naming without requiring schema changes.
 * All functions are null-safe and return predictable types.
 */

import { warnPoEtaMismatch, warnPoMissingSupplier } from './domainWarnings';

// ============================================================================
// PURCHASE ORDER ADAPTERS
// ============================================================================

/**
 * Get ETA/expected delivery date from a Purchase Order
 * @param {Object} po - Purchase Order object
 * @returns {string|null} - ISO date string or null
 */
export function getPoEta(po) {
  if (!po) return null;
  
  // Warn about ETA field disagreement
  warnPoEtaMismatch(po);
  
  return po.expected_date || po.expected_delivery_date || po.eta || po.due_date || null;
}

/**
 * Create payload for setting PO ETA (backend contract: uses 'eta' field)
 * @param {string|null} value - ISO date string or null
 * @returns {Object} - Update payload object
 */
export function setPoEtaPayload(value) {
  return { eta: value ?? null };
}

/**
 * Get supplier ID from a Purchase Order
 * @param {Object} po - Purchase Order object
 * @returns {string|null} - Supplier ID or null
 */
export function getPoSupplierId(po) {
  if (!po) return null;
  return po.supplier_id || po.supplierId || null;
}

/**
 * Get supplier name from a Purchase Order
 * @param {Object} po - Purchase Order object
 * @returns {string|null} - Supplier name or null
 */
export function getPoSupplierName(po) {
  if (!po) return null;
  
  // Warn about missing supplier
  warnPoMissingSupplier(po);
  
  return po.supplier_name || po.supplierName || null;
}

/**
 * Get PO reference/number for display
 * Checks multiple possible field names and returns the first available
 * @param {Object} po - Purchase Order object
 * @param {Object} part - Optional Part object (may have cached PO reference)
 * @returns {string} - PO reference string (empty string if none found)
 */
export function getPoReference(po, part = null) {
  if (!po && !part) return '';
  
  // Try PO object first
  if (po) {
    const ref = po.po_number || 
                po.po_reference || 
                po.order_reference || 
                po.reference || 
                po.name;
    if (ref) return String(ref);
    
    // Fallback to truncated ID
    if (po.id) return String(po.id).slice(0, 8);
  }
  
  // Try part object's cached fields
  if (part) {
    return part.po_number || part.order_reference || '';
  }
  
  return '';
}

/**
 * Get formatted PO display name for UI
 * @param {Object} po - Purchase Order object
 * @param {Object} part - Optional Part object
 * @returns {string} - Formatted display string (e.g., "PO #12345" or empty)
 */
export function getPoDisplayName(po, part = null) {
  const ref = getPoReference(po, part);
  return ref ? `PO #${ref}` : '';
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Safely parse a date value without throwing errors
 * @param {string|Date|number|null|undefined} value - Value to parse
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function safeParseDate(value) {
  if (!value) return null;
  
  try {
    // If already a Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    
    // Try parsing as ISO string or timestamp
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Format a date value safely
 * @param {string|Date|null} value - Date value
 * @param {string} fallback - Fallback string if invalid
 * @returns {string} - Formatted date or fallback
 */
export function safeDateDisplay(value, fallback = '-') {
  const date = safeParseDate(value);
  return date ? date.toLocaleDateString('en-AU') : fallback;
}

// ============================================================================
// PART ADAPTERS
// ============================================================================

/**
 * Get part quantity required (handles different field names)
 * @param {Object} part - Part object
 * @returns {number} - Quantity (defaults to 1)
 */
export function getPartQuantity(part) {
  if (!part) return 1;
  return part.quantity_required || part.quantity || 1;
}

/**
 * Get part item name for display
 * @param {Object} part - Part object
 * @returns {string} - Display name
 */
export function getPartDisplayName(part) {
  if (!part) return 'Part';
  return part.item_name || part.name || part.category || 'Part';
}

// ============================================================================
// SUPPLIER ADAPTERS
// ============================================================================

/**
 * Get supplier name safely
 * @param {Object} supplier - Supplier object
 * @returns {string} - Supplier name or empty string
 */
export function getSupplierName(supplier) {
  if (!supplier) return '';
  return supplier.name || supplier.supplier_name || '';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // PO adapters
  getPoEta,
  setPoEtaPayload,
  getPoSupplierId,
  getPoSupplierName,
  getPoReference,
  getPoDisplayName,
  
  // Date utilities
  safeParseDate,
  safeDateDisplay,
  
  // Part adapters
  getPartQuantity,
  getPartDisplayName,
  
  // Supplier adapters
  getSupplierName,
};