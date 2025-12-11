/**
 * Purchase Order Status Configuration
 * Central source of truth for all PO status values and labels
 */

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

export const PO_STATUS_LABELS = {
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

// Helper to get UI label for a status
export function getPoStatusLabel(status) {
  return PO_STATUS_LABELS[status] || status || "Unknown";
}

// Normalize legacy status values to canonical ones
export function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  switch (status.toLowerCase()) {
    case "draft":
      return PO_STATUS.DRAFT;
    
    case "sent":
      return PO_STATUS.SENT;

    case "on_order":
    case "on order":
      return PO_STATUS.ON_ORDER;

    case "partially_received":
    case "in_transit":
    case "in transit":
      return PO_STATUS.IN_TRANSIT;

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
    case "in_loading_bay":
    case "in loading bay":
    case "loadingbay":
      return PO_STATUS.IN_LOADING_BAY;

    case "in_storage":
    case "in storage":
    case "completed - in storage":
      return PO_STATUS.IN_STORAGE;

    case "in_vehicle":
    case "in vehicle":
    case "completed - in vehicle":
      return PO_STATUS.IN_VEHICLE;

    case "installed":
      return PO_STATUS.INSTALLED;

    case "cancelled":
      return PO_STATUS.CANCELLED;

    default:
      return status;
  }
}