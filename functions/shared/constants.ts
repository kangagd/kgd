/**
 * Shared constants for Purchase Orders, Parts, and Logistics
 * SINGLE SOURCE OF TRUTH - Import from here only
 */

export const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

export const PO_DELIVERY_METHOD = {
  DELIVERY: "delivery",
  PICKUP: "pickup",
};

export const LOGISTICS_PURPOSE = {
  PO_DELIVERY_TO_WAREHOUSE: "po_delivery_to_warehouse",
  PO_PICKUP_FROM_SUPPLIER: "po_pickup_from_supplier",
  PART_PICKUP_FOR_INSTALL: "part_pickup_for_install",
  MANUAL_CLIENT_DROPOFF: "manual_client_dropoff",
  SAMPLE_DROPOFF: "sample_dropoff",
  SAMPLE_PICKUP: "sample_pickup",
};