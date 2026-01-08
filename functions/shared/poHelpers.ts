/**
 * Purchase Order helper functions
 * SINGLE SOURCE OF TRUTH for PO operations
 */

import { PO_STATUS } from './constants.js';

// Get first non-empty value from multiple inputs
export function firstNonEmpty(...values) {
  for (const val of values) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

// Resolve PO reference from multiple possible field names
export function resolvePoRef({ data, po_reference, po_number, reference, order_reference }) {
  return firstNonEmpty(
    po_reference,
    data?.po_reference,
    po_number,
    data?.po_number,
    order_reference,
    data?.order_reference,
    reference,
    data?.reference
  );
}

// Normalize legacy PO status values to canonical ones
export function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  const normalized = status.toLowerCase().replace(/[\s_-]/g, '');

  switch (normalized) {
    case "draft":
      return PO_STATUS.DRAFT;
    
    case "sent":
      return PO_STATUS.SENT;

    case "onorder":
      return PO_STATUS.ON_ORDER;

    case "partiallyreceived":
    case "intransit":
      return PO_STATUS.IN_TRANSIT;

    case "received":
    case "delivered":
    case "deliveredloadingbay":
    case "deliveredtodeliverybay":
    case "deliveredtoloadingbay":
    case "readyforpickup":
    case "readytopickup":
    case "arrived":
    case "atdeliverybay":
    case "indeliverybay":
    case "loadingbay":
    case "inloadingbay":
      return PO_STATUS.IN_LOADING_BAY;

    case "atsupplier":
      return PO_STATUS.AT_SUPPLIER;

    case "instorage":
    case "completedinstorage":
      return PO_STATUS.IN_STORAGE;

    case "invehicle":
    case "completedinvehicle":
      return PO_STATUS.IN_VEHICLE;

    case "installed":
      return PO_STATUS.INSTALLED;

    case "cancelled":
      return PO_STATUS.CANCELLED;

    default:
      return status;
  }
}