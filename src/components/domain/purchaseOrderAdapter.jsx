/**
 * Purchase Order Data Adapter
 * Pure functions to transform PO data from database format to UI format
 */

import { normaliseLegacyPoStatus } from './purchaseOrderStatusConfig';
import { getPoDisplayReference } from './poDisplayHelpers';
import { sameId } from '../utils/id';

/**
 * Transform PO from database format to UI format
 * @param {Object} po - Purchase Order from database
 * @returns {Object} UI-formatted purchase order
 */
export function poDbToUi(po) {
  if (!po) return null;

  return {
    id: po.id,
    supplierId: po.supplier_id,
    supplierName: po.supplier_name,
    status: po.status,
    statusKey: normaliseLegacyPoStatus(po.status),
    eta: po.expected_date,
    poReference: getPoDisplayReference(po),
    name: po.name,
    deliveryMethod: po.delivery_method,
    orderDate: po.order_date,
    notes: po.notes,
    attachments: po.attachments || [],
    linkedLogisticsJobId: po.linked_logistics_job_id,
    projectId: po.project_id,
    createdDate: po.created_date,
    updatedDate: po.updated_date,
    createdBy: po.created_by,
  };
}

/**
 * Get display name for PO's supplier with fallback
 * @param {Object} po - Purchase Order
 * @param {Array} suppliers - Array of supplier entities
 * @returns {string} Supplier display name
 */
export function getPoDisplaySupplierName(po, suppliers = []) {
  if (!po) return 'Unknown Supplier';
  
  // Try to find supplier by ID
  if (po.supplier_id) {
    const supplier = suppliers.find(s => sameId(s.id, po.supplier_id));
    if (supplier?.name) return supplier.name;
  }
  
  // Fallback to cached supplier name
  if (po.supplier_name) return po.supplier_name;
  
  return 'Unknown Supplier';
}