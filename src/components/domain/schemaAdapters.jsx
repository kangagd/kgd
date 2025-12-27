/**
 * Schema Adapters - Pure functions to standardize field access across entities
 * 
 * REMOVED: All Purchase Order and Part adapters (HARD RESET - 2025-12-27)
 * KEPT: Date utilities and Supplier adapters (still used elsewhere)
 */

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
  // Date utilities
  safeParseDate,
  safeDateDisplay,
  
  // Supplier adapters
  getSupplierName,
};