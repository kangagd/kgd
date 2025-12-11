/**
 * Logistics Domain Configuration
 * Centralizes constants for delivery methods, locations, and part statuses
 * 
 * NOTE: Purchase Order statuses have been moved to purchaseOrderStatusConfig.js
 * This file is kept for backward compatibility and will export from the new location
 */

// Re-export PO status constants from the new location for backward compatibility
export { 
  PO_STATUS, 
  PO_STATUS_OPTIONS, 
  PO_STATUS_LABELS,
  getPoStatusLabel, 
  normalizeLegacyPoStatus 
} from './purchaseOrderStatusConfig';

// Deprecated - use the exports from purchaseOrderStatusConfig.js directly
export const normaliseLegacyPoStatus = (status) => {
  const { normalizeLegacyPoStatus } = require('./purchaseOrderStatusConfig');
  return normalizeLegacyPoStatus(status);
};

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