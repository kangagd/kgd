/**
 * Purchase Order Status Configuration
 * Central source of truth for all PO status values, labels, and colors
 * 
 * Internally sources definitions from statusRegistry.jsx to avoid duplication
 */

import { 
  PO_STATUS as REGISTRY_PO_STATUS,
  normalizeStatus 
} from './statusRegistry';
import { warnUnknownPoStatus } from './domainWarnings';

// Re-export PO_STATUS from statusRegistry for consistency
export const PO_STATUS = REGISTRY_PO_STATUS;

// Known statuses for warning detection
const KNOWN_PO_STATUSES = new Set(Object.values(PO_STATUS).map(s => normalizeStatus(s)));

export const PO_STATUS_OPTIONS = Object.values(PO_STATUS);

// Status options for non-project POs (stops at In Storage)
export const PO_STATUS_OPTIONS_NON_PROJECT = [
  PO_STATUS.DRAFT,
  PO_STATUS.SENT,
  PO_STATUS.ON_ORDER,
  PO_STATUS.IN_TRANSIT,
  PO_STATUS.IN_LOADING_BAY,
  PO_STATUS.IN_STORAGE,
];

// Status options for project POs (includes vehicle and installed)
export const PO_STATUS_OPTIONS_PROJECT = PO_STATUS_OPTIONS;

// Status labels - sourced from statusRegistry
export const PO_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  on_order: "On Order",
  in_transit: "In Transit",
  in_loading_bay: "In Loading Bay",
  at_supplier: "At Supplier",
  in_storage: "In Storage",
  in_vehicle: "In Vehicle",
  installed: "Installed",
  cancelled: "Cancelled",
};

// Normalize status string - delegate to statusRegistry for consistency
export const normalizePoStatus = (status) => normalizeStatus(status);

// Status → Label mapping function
export function getPoStatusLabel(status) {
  const key = normalizePoStatus(status);
  return PO_STATUS_LABELS[key] || PO_STATUS_LABELS[status] || String(status || '');
}

// Legacy status normaliser - maps various input formats to canonical PO_STATUS values
// This is the compatibility layer for historical data
export function normaliseLegacyPoStatus(input) {
  if (!input) return PO_STATUS.DRAFT;
  
  // Warn about unknown statuses
  warnUnknownPoStatus(input, KNOWN_PO_STATUSES);
  
  // Use statusRegistry normalizer for consistency
  const s = normalizeStatus(input);

  switch (s) {
    case "draft":
      return PO_STATUS.DRAFT;
    case "sent":
      return PO_STATUS.SENT;
    case "on_order":
      return PO_STATUS.ON_ORDER;
    case "in_transit":
    case "partially_received":
      return PO_STATUS.IN_TRANSIT;
    case "in_loading_bay":
    case "received":
    case "delivered":
    case "delivered_loading_bay":
    case "delivered_to_delivery_bay":
    case "delivered_to_loading_bay":
    case "ready_for_pick_up":
    case "ready_to_pick_up":
    case "arrived":
    case "at_delivery_bay":
    case "in_delivery_bay":
    case "loadingbay":
      return PO_STATUS.IN_LOADING_BAY;
    case "at_supplier":
      return PO_STATUS.AT_SUPPLIER;
    case "in_storage":
    case "completed_in_storage":
      return PO_STATUS.IN_STORAGE;
    case "in_vehicle":
    case "completed_in_vehicle":
      return PO_STATUS.IN_VEHICLE;
    case "installed":
      return PO_STATUS.INSTALLED;
    case "cancelled":
      return PO_STATUS.CANCELLED;
    default:
      return PO_STATUS.DRAFT;
  }
}



// Colour mapping for badges - sourced from statusRegistry
export const PO_STATUS_COLORS = {
  draft: "bg-gray-200 text-gray-800",
  sent: "bg-blue-200 text-blue-800",
  on_order: "bg-amber-200 text-amber-800",
  in_transit: "bg-purple-200 text-purple-800",
  in_loading_bay: "bg-orange-200 text-orange-800",
  at_supplier: "bg-yellow-200 text-yellow-800",
  in_storage: "bg-green-200 text-green-800",
  in_vehicle: "bg-indigo-200 text-indigo-800",
  installed: "bg-teal-200 text-teal-800",
  cancelled: "bg-red-200 text-red-800",
};

// Get color class for status badge
export function getPoStatusColor(status) {
  const key = normalizePoStatus(status);
  return PO_STATUS_COLORS[key] || PO_STATUS_COLORS[status] || 'bg-gray-200 text-gray-800';
}

// Export object at bottom
export default {
  PO_STATUS,
  PO_STATUS_OPTIONS,
  PO_STATUS_OPTIONS_NON_PROJECT,
  PO_STATUS_OPTIONS_PROJECT,
  getPoStatusLabel,
  getPoStatusColor,
  PO_STATUS_LABELS,
  normalizePoStatus,
  normaliseLegacyPoStatus,
  PO_STATUS_COLORS,
};