/**
 * Part Configuration
 * Central source of truth for Part status and location values
 */

export const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PART_STATUS_OPTIONS = Object.values(PART_STATUS);

export const PART_STATUS_LABELS = {
  pending: "Pending",
  on_order: "On Order",
  in_transit: "In Transit",
  in_loading_bay: "In Loading Bay",
  in_storage: "In Storage",
  in_vehicle: "In Vehicle",
  installed: "Installed",
  cancelled: "Cancelled",
};

export function getPartStatusLabel(status) {
  return PART_STATUS_LABELS[status] || status || "Unknown";
}

export const PART_LOCATION = {
  SUPPLIER: "supplier",
  DELIVERY_BAY: "delivery_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

export const PART_LOCATION_OPTIONS = Object.values(PART_LOCATION);

export const PART_LOCATION_LABELS = {
  supplier: "At Supplier",
  delivery_bay: "Delivery Bay",
  warehouse_storage: "Warehouse Storage",
  vehicle: "In Vehicle",
  client_site: "At Client Site",
};

export function getPartLocationLabel(location) {
  return PART_LOCATION_LABELS[location] || location || "Unknown";
}

// Normalize legacy part status values
export function normaliseLegacyPartStatus(status) {
  if (!status) return PART_STATUS.PENDING;

  switch (status.toLowerCase().replace(/\s+/g, "_")) {
    case "pending":
      return PART_STATUS.PENDING;

    case "ordered":
    case "on_order":
    case "on_order":
      return PART_STATUS.ON_ORDER;

    case "back-ordered":
    case "back_ordered":
    case "in_transit":
    case "in_transit":
      return PART_STATUS.IN_TRANSIT;

    case "delivered":
    case "arrived":
    case "in_loading_bay":
    case "in_loading_bay":
      return PART_STATUS.IN_LOADING_BAY;

    case "in_storage":
    case "in_storage":
      return PART_STATUS.IN_STORAGE;

    case "on_vehicle":
    case "in_vehicle":
    case "in_vehicle":
    case "with_technician":
      return PART_STATUS.IN_VEHICLE;

    case "installed":
    case "at_client_site":
      return PART_STATUS.INSTALLED;

    case "returned":
    case "cancelled":
    case "cancelled":
      return PART_STATUS.CANCELLED;

    default:
      return status;
  }
}

// Normalize legacy part location values
export function normaliseLegacyPartLocation(location) {
  if (!location) return PART_LOCATION.SUPPLIER;

  switch (location.toLowerCase().replace(/\s+/g, "_")) {
    case "on_order":
    case "at_supplier":
    case "supplier":
      return PART_LOCATION.SUPPLIER;

    case "at_delivery_bay":
    case "delivery_bay":
    case "loading_bay":
      return PART_LOCATION.DELIVERY_BAY;

    case "in_warehouse_storage":
    case "warehouse_storage":
    case "storage":
      return PART_LOCATION.WAREHOUSE_STORAGE;

    case "with_technician":
    case "on_vehicle":
    case "vehicle":
      return PART_LOCATION.VEHICLE;

    case "at_client_site":
    case "client_site":
    case "site":
      return PART_LOCATION.CLIENT_SITE;

    default:
      return location;
  }
}