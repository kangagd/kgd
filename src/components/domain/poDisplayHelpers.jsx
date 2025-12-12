/**
 * Purchase Order Display Helpers
 * Helper functions for displaying PO references consistently
 */

/**
 * Get the display reference for a purchase order
 * Uses po_number as canonical field, with fallbacks to legacy fields
 * @param {Object} po - Purchase order object
 * @returns {string} PO reference for display
 */
export function getPORef(po) {
  if (!po) return '';
  
  return (
    po.po_number ||
    po.order_reference ||
    po.reference ||
    po.id?.substring(0, 8) ||
    ''
  );
}

/**
 * Get the display reference with PO# prefix
 * @param {Object} po - Purchase order object
 * @returns {string} Formatted PO reference (e.g., "PO #ABC123")
 */
export function getPORefFormatted(po) {
  const ref = getPORef(po);
  return ref ? `PO #${ref}` : 'PO #Unknown';
}