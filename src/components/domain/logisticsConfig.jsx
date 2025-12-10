
/**
 * Logistics Domain Configuration
 * Centralizes constants for purchase orders, delivery methods, locations, and part statuses
 */

export const PO_STATUS = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  READY_TO_PICK_UP: "Ready to Pick Up",
  DELIVERED_TO_DELIVERY_BAY: "Delivered to Delivery Bay",
  COMPLETED_IN_STORAGE: "Completed - In Storage",
  COMPLETED_IN_VEHICLE: "Completed - In Vehicle",
};

export const PO_STATUS_OPTIONS = Object.values(PO_STATUS);

export const PO_DELIVERY_METHOD = {
  DELIVERY: "delivery",
  PICKUP: "pickup",
};

export const PO_DELIVERY_METHOD_OPTIONS = Object.values(PO_DELIVERY_METHOD);

export const LOGISTICS_LOCATION = {
  SUPPLIER: "Supplier",
  LOADING_BAY: "Loading Bay",
  DELIVERY_BAY: "Loading Bay", // Alias for backwards compatibility
  STORAGE: "Storage",
  WAREHOUSE: "Storage", // Alias for backwards compatibility
  VEHICLE: "Vehicle",
  WITH_TECHNICIAN: "Vehicle", // Alias for backwards compatibility
  SITE: "Site",
};

export const LOGISTICS_LOCATION_OPTIONS = Object.values(LOGISTICS_LOCATION);

export const PART_STATUS = {
  ON_ORDER: "On Order",
  IN_TRANSIT: "In Transit",
  ARRIVED: "Arrived",
  IN_LOADING_BAY: "In Loading Bay",
  IN_STORAGE: "In Storage",
  ON_VEHICLE: "On Vehicle",
  INSTALLED: "Installed",
};

export const PART_STATUS_OPTIONS = Object.values(PART_STATUS);

export const LOGISTICS_JOB_TYPE_NAME = "Logistics";
