
/**
 * Logistics Domain Configuration - LEGACY FILE
 * This file is deprecated. Use the new unified config files instead:
 * - @/components/domain/purchaseOrderStatusConfig
 * - @/components/domain/partConfig
 * - @/components/domain/supplierDeliveryConfig
 * 
 * Kept for backwards compatibility during migration.
 */

// Re-export from new unified configs
export { 
  PO_STATUS, 
  PO_STATUS_LABELS, 
  PO_STATUS_OPTIONS, 
  getPoStatusLabel, 
  normaliseLegacyPoStatus 
} from "./purchaseOrderStatusConfig";

export { 
  PART_STATUS, 
  PART_STATUS_OPTIONS, 
  PART_LOCATION, 
  PART_LOCATION_OPTIONS,
  getPartStatusLabel,
  getPartLocationLabel,
  normaliseLegacyPartStatus,
  normaliseLegacyPartLocation
} from "./partConfig";

export { 
  DELIVERY_METHOD as PO_DELIVERY_METHOD,
  DELIVERY_METHOD_OPTIONS as PO_DELIVERY_METHOD_OPTIONS,
  SOURCE_TYPE,
  SOURCE_TYPE_OPTIONS,
  getSourceTypeLabel,
  normaliseLegacySourceType
} from "./supplierDeliveryConfig";

// Status options for non-project POs
export const PO_STATUS_OPTIONS_NON_PROJECT = [
  "draft",
  "sent",
  "on_order",
  "in_transit",
  "in_loading_bay",
  "in_storage",
];

// Status options for project POs
export const PO_STATUS_OPTIONS_PROJECT = [
  "draft",
  "sent",
  "on_order",
  "in_transit",
  "in_loading_bay",
  "in_storage",
  "in_vehicle",
  "installed",
  "cancelled",
];

// Location constants (for UI display)
export const LOGISTICS_LOCATION = {
  SUPPLIER: "Supplier",
  LOADING_BAY: "Loading Bay",
  STORAGE: "Storage",
  VEHICLE: "Vehicle",
  SITE: "Site",
};

export const LOGISTICS_LOCATION_OPTIONS = Object.values(LOGISTICS_LOCATION);

export const LOGISTICS_JOB_TYPE_NAME = "Logistics";
