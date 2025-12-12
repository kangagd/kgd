/**
 * Purchase Order Status Configuration
 * Central source of truth for all PO status values, labels, and colors
 */

// Full PO status enum
export const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

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

// Status → Label mapping function
export function getPoStatusLabel(status) {
  const map = {
    draft: "Draft",
    sent: "Sent",
    on_order: "On Order",
    in_transit: "In Transit",
    in_loading_bay: "In Loading Bay",
    in_storage: "In Storage",
    in_vehicle: "In Vehicle",
    installed: "Installed",
    cancelled: "Cancelled",
  };
  return map[status] || "Unknown";
}

// Status normaliser
export function normalizePoStatus(input) {
  if (!input) return PO_STATUS.DRAFT;
  const s = input.toString().trim().toLowerCase();

  switch (s) {
    case "draft":
      return PO_STATUS.DRAFT;
    case "sent":
      return PO_STATUS.SENT;
    case "on order":
    case "on_order":
      return PO_STATUS.ON_ORDER;
    case "in transit":
    case "in_transit":
    case "partially_received":
      return PO_STATUS.IN_TRANSIT;
    case "in loading bay":
    case "in_loading_bay":
    case "received":
    case "delivered":
    case "delivered - loading bay":
    case "delivered_loading_bay":
    case "delivered to delivery bay":
    case "delivered to loading bay":
    case "delivered_to_delivery_bay":
    case "ready for pick up":
    case "ready to pick up":
    case "ready_to_pick_up":
    case "arrived":
    case "at_delivery_bay":
    case "at delivery bay":
    case "in_delivery_bay":
    case "in delivery bay":
    case "loadingbay":
      return PO_STATUS.IN_LOADING_BAY;
    case "in storage":
    case "in_storage":
    case "completed - in storage":
      return PO_STATUS.IN_STORAGE;
    case "in vehicle":
    case "in_vehicle":
    case "completed - in vehicle":
      return PO_STATUS.IN_VEHICLE;
    case "installed":
      return PO_STATUS.INSTALLED;
    case "cancelled":
      return PO_STATUS.CANCELLED;
    default:
      return PO_STATUS.DRAFT;
  }
}

// Legacy alias for backward compatibility
export const normaliseLegacyPoStatus = normalizePoStatus;

// Colour mapping for badges
export const PO_STATUS_COLORS = {
  draft: "bg-gray-200 text-gray-800",
  sent: "bg-blue-200 text-blue-800",
  on_order: "bg-amber-200 text-amber-800",
  in_transit: "bg-purple-200 text-purple-800",
  in_loading_bay: "bg-orange-200 text-orange-800",
  in_storage: "bg-green-200 text-green-800",
  in_vehicle: "bg-indigo-200 text-indigo-800",
  installed: "bg-teal-200 text-teal-800",
  cancelled: "bg-red-200 text-red-800",
};

// Export object at bottom
export default {
  PO_STATUS,
  PO_STATUS_OPTIONS,
  PO_STATUS_OPTIONS_NON_PROJECT,
  PO_STATUS_OPTIONS_PROJECT,
  getPoStatusLabel,
  normalizePoStatus,
  normaliseLegacyPoStatus,
  PO_STATUS_COLORS,
};