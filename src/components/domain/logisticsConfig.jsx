/**
 * Logistics Domain Configuration
 * Centralizes constants for purchase orders, delivery methods, locations, and part statuses
 */

// Canonical PO status values (stored in DB)
export const PO_STATUS = {
  DRAFT: "draft",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

// UI labels for PO statuses
export const PO_STATUS_LABELS = {
  [PO_STATUS.DRAFT]: "Draft",
  [PO_STATUS.ON_ORDER]: "On Order",
  [PO_STATUS.IN_TRANSIT]: "In Transit",
  [PO_STATUS.IN_LOADING_BAY]: "In Loading Bay",
  [PO_STATUS.IN_STORAGE]: "In Storage",
  [PO_STATUS.IN_VEHICLE]: "In Vehicle",
  [PO_STATUS.INSTALLED]: "Installed",
  [PO_STATUS.CANCELLED]: "Cancelled",
};

// Helper to get UI label for a status
export function getPoStatusLabel(status) {
  return PO_STATUS_LABELS[status] || status || "Unknown";
}

// Normalize legacy status values to canonical ones
export function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  switch (status) {
    case "draft":
    case PO_STATUS.DRAFT:
      return PO_STATUS.DRAFT;

    case "sent":
    case "Sent":
      return PO_STATUS.ON_ORDER;

    case "partially_received":
      return PO_STATUS.IN_TRANSIT;

    case "received":
      return PO_STATUS.IN_STORAGE;

    case "cancelled":
    case "Cancelled":
    case PO_STATUS.CANCELLED:
      return PO_STATUS.CANCELLED;

    // Legacy display strings -> canonical
    case "On Order":
      return PO_STATUS.ON_ORDER;
    case "In Transit":
      return PO_STATUS.IN_TRANSIT;
    case "Delivered - Loading Bay":
    case "Delivered to Delivery Bay":
      return PO_STATUS.IN_LOADING_BAY;
    case "Ready for Pick up":
    case "Ready to Pick Up":
      return PO_STATUS.IN_LOADING_BAY;
    case "In Storage":
    case "Completed - In Storage":
      return PO_STATUS.IN_STORAGE;
    case "In Vehicle":
    case "Completed - In Vehicle":
      return PO_STATUS.IN_VEHICLE;
    case "Installed":
      return PO_STATUS.INSTALLED;

    // If already canonical, pass through
    case PO_STATUS.ON_ORDER:
    case PO_STATUS.IN_TRANSIT:
    case PO_STATUS.IN_LOADING_BAY:
    case PO_STATUS.IN_STORAGE:
    case PO_STATUS.IN_VEHICLE:
    case PO_STATUS.INSTALLED:
      return status;

    default:
      return status;
  }
}

export const PO_STATUS_OPTIONS = [
  PO_STATUS.DRAFT,
  PO_STATUS.ON_ORDER,
  PO_STATUS.IN_TRANSIT,
  PO_STATUS.IN_LOADING_BAY,
  PO_STATUS.IN_STORAGE,
  PO_STATUS.IN_VEHICLE,
  PO_STATUS.INSTALLED,
  PO_STATUS.CANCELLED,
];

// Status options for non-project POs (stops at In Storage)
export const PO_STATUS_OPTIONS_NON_PROJECT = [
  PO_STATUS.DRAFT,
  PO_STATUS.ON_ORDER,
  PO_STATUS.IN_TRANSIT,
  PO_STATUS.IN_LOADING_BAY,
  PO_STATUS.IN_STORAGE,
];

// Status options for project POs (includes vehicle and installed)
export const PO_STATUS_OPTIONS_PROJECT = PO_STATUS_OPTIONS;

export const PO_DELIVERY_METHOD = {
  DELIVERY: "delivery",
  PICKUP: "pickup",
};

export const PO_DELIVERY_METHOD_OPTIONS = Object.values(PO_DELIVERY_METHOD);

export const LOGISTICS_LOCATION = {
  SUPPLIER: "Supplier",
  LOADING_BAY: "Loading Bay",
  STORAGE: "Storage",
  VEHICLE: "Vehicle",
  SITE: "Site",
};

export const LOGISTICS_LOCATION_OPTIONS = [
  LOGISTICS_LOCATION.SUPPLIER,
  LOGISTICS_LOCATION.LOADING_BAY,
  LOGISTICS_LOCATION.STORAGE,
  LOGISTICS_LOCATION.VEHICLE,
  LOGISTICS_LOCATION.SITE,
];

export const PART_STATUS = {
  ON_ORDER: "On Order",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
  IN_LOADING_BAY: "In Loading Bay",
  IN_STORAGE: "In Storage",
  IN_VEHICLE: "In Vehicle",
  INSTALLED: "Installed",
};

export const PART_STATUS_OPTIONS = Object.values(PART_STATUS);

export const LOGISTICS_JOB_TYPE_NAME = "Logistics";