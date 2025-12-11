/**
 * Purchase Order Status Configuration
 * Centralizes canonical PO status values and labels
 */

export const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  DELIVERED_LOADING_BAY: "delivered_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PO_STATUS_LABELS = {
  [PO_STATUS.DRAFT]: "Draft",
  [PO_STATUS.SENT]: "Sent",
  [PO_STATUS.ON_ORDER]: "On Order",
  [PO_STATUS.IN_TRANSIT]: "In Transit",
  [PO_STATUS.DELIVERED_LOADING_BAY]: "Delivered – Loading Bay",
  [PO_STATUS.IN_STORAGE]: "In Storage",
  [PO_STATUS.IN_VEHICLE]: "In Vehicle",
  [PO_STATUS.INSTALLED]: "Installed",
  [PO_STATUS.CANCELLED]: "Cancelled",
};

export const PO_STATUS_OPTIONS = Object.values(PO_STATUS);

// Helper to get label for a status value
export function getPoStatusLabel(status) {
  return PO_STATUS_LABELS[status] || status || "Unknown";
}

// Normalize legacy status values to canonical ones
export function normalizeLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  // Already canonical
  if (Object.values(PO_STATUS).includes(status)) {
    return status;
  }

  // Legacy mappings
  const legacyMap = {
    "On Order": PO_STATUS.ON_ORDER,
    "In Transit": PO_STATUS.IN_TRANSIT,
    "Delivered - Loading Bay": PO_STATUS.DELIVERED_LOADING_BAY,
    "Delivered to Delivery Bay": PO_STATUS.DELIVERED_LOADING_BAY,
    "Ready for Pick up": PO_STATUS.DELIVERED_LOADING_BAY,
    "Ready to Pick Up": PO_STATUS.DELIVERED_LOADING_BAY,
    "In Storage": PO_STATUS.IN_STORAGE,
    "Completed - In Storage": PO_STATUS.IN_STORAGE,
    "In Vehicle": PO_STATUS.IN_VEHICLE,
    "Completed - In Vehicle": PO_STATUS.IN_VEHICLE,
    "Installed": PO_STATUS.INSTALLED,
    "Sent": PO_STATUS.SENT,
    "Cancelled": PO_STATUS.CANCELLED,
    "Draft": PO_STATUS.DRAFT,
    // Old system statuses
    "received": PO_STATUS.IN_STORAGE,
    "partially_received": PO_STATUS.IN_TRANSIT,
  };

  return legacyMap[status] || status;
}