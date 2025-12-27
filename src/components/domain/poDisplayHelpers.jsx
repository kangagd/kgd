/**
 * Purchase Order Display Helpers
 * Canonical display logic for PO references and names
 */

/**
 * Get the display reference for a Purchase Order
 * Checks multiple fields in priority order for maximum compatibility
 * @param {Object} po - Purchase Order object
 * @returns {string} Display reference (first non-empty value or fallback)
 */
export function getPoDisplayReference(po) {
  if (!po) return 'Unknown PO';
  
  // Check fields in priority order
  const ref = po.po_reference?.trim() || 
              po.po_ref?.trim() || 
              po.reference?.trim() || 
              po.po_number?.trim() || 
              po.name?.trim() || 
              null;
  
  return ref || `PO-${po.id?.slice(0, 8)}`;
}

/**
 * Get the full display title for a Purchase Order (with name if available)
 * @param {Object} po - Purchase Order object
 * @returns {string} Display title
 */
export function getPoDisplayTitle(po) {
  if (!po) return 'Unknown PO';
  
  const ref = getPoDisplayReference(po);
  const name = po.name?.trim();
  
  return name ? `${ref} - ${name}` : ref;
}

/**
 * Get canonical PO identity (reference + name)
 * 
 * @param {Object} po - Purchase Order object
 * @returns {Object} { reference: string, name: string|null }
 */
export function getPoIdentity(po) {
  return {
    reference: po?.po_reference || getPoDisplayReference(po),
    name: po?.name || null
  };
}

/**
 * Get part location based on PO status
 * @param {string} status - PO status
 * @returns {string} Part location
 */
export function getPartLocationFromPoStatus(status) {
  const statusToLocation = {
    'draft': 'supplier',
    'sent': 'supplier',
    'on_order': 'supplier',
    'in_transit': 'in_transit',
    'in_loading_bay': 'delivery_bay',
    'in_storage': 'warehouse_storage',
    'in_vehicle': 'vehicle',
    'installed': 'client_site',
    'cancelled': 'supplier'
  };
  
  return statusToLocation[status] || 'supplier';
}

/**
 * Validate PO has required identity fields before save
 * @param {Object} poData - PO data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePoIdentityFields(poData) {
  const errors = [];
  
  if (!poData.po_reference?.trim()) {
    errors.push('PO Reference is required');
    if (process.env.NODE_ENV === 'development') {
      console.warn('PO save attempted without po_reference');
    }
  }
  
  if (!poData.supplier_id) {
    errors.push('Supplier is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}