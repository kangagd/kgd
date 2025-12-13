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

/**
 * Check if a part is physically available for picking/installation
 * Parts are only available when they've physically arrived at warehouse or vehicle
 */
export function isPartAvailable(part) {
  if (!part) return false;
  
  // Must be in storage or vehicle to be available
  const isInUsableLocation = 
    part.status === PART_STATUS.IN_STORAGE || 
    part.status === PART_STATUS.IN_VEHICLE;
  
  // Must NOT be at supplier
  const notAtSupplier = part.location !== PART_LOCATION.SUPPLIER;
  
  return isInUsableLocation && notAtSupplier;
}

/**
 * Check if a part represents a shortage
 * Parts are considered shortage if they're needed but not physically available
 */
export function isPartShortage(part) {
  if (!part) return false;
  
  // Cancelled or installed parts are not shortages
  if (part.status === PART_STATUS.CANCELLED || part.status === PART_STATUS.INSTALLED) {
    return false;
  }
  
  // If not available, it's a shortage
  return !isPartAvailable(part);
}

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

export const PART_CATEGORIES = [
  "Door",
  "Motor",
  "Posts",
  "Tracks",
  "Small Parts",
  "Hardware",
  "Other"
];

export const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

export const PART_LOCATION_OPTIONS = Object.values(PART_LOCATION);

export const PART_LOCATION_LABELS = {
  supplier: "At Supplier",
  loading_bay: "Loading Bay",
  warehouse_storage: "Warehouse Storage",
  vehicle: "In Vehicle",
  client_site: "At Client Site",
};

export function getPartLocationLabel(location) {
  return PART_LOCATION_LABELS[location] || location || "Unknown";
}

// Normalize legacy part status values
export function normaliseLegacyPartStatus(status, part = null) {
  if (!status) {
    // If no status but has PO info, default to on_order
    if (part?.purchase_order_id || part?.po_number || part?.order_reference) {
      return PART_STATUS.ON_ORDER;
    }
    return PART_STATUS.PENDING;
  }

  switch (status.toLowerCase().replace(/\s+/g, "_")) {
    case "pending":
      return PART_STATUS.PENDING;

    case "ordered":
    case "on_order":
      return PART_STATUS.ON_ORDER;

    case "back-ordered":
    case "back_ordered":
    case "in_transit":
      return PART_STATUS.IN_TRANSIT;

    case "delivered":
    case "arrived":
    case "in_loading_bay":
      return PART_STATUS.IN_LOADING_BAY;

    case "in_storage":
      return PART_STATUS.IN_STORAGE;

    case "on_vehicle":
    case "in_vehicle":
    case "with_technician":
      return PART_STATUS.IN_VEHICLE;

    case "installed":
    case "at_client_site":
      return PART_STATUS.INSTALLED;

    case "returned":
    case "cancelled":
      return PART_STATUS.CANCELLED;

    default:
      // If unknown status but has PO info, default to on_order
      if (part?.purchase_order_id || part?.po_number || part?.order_reference) {
        return PART_STATUS.ON_ORDER;
      }
      return status;
  }
}

// Normalize legacy part location values
export function normaliseLegacyPartLocation(location) {
  if (!location) return PART_LOCATION.SUPPLIER;

  const normalized = location.toLowerCase().replace(/\s+/g, "_");
  
  if (normalized.includes("supplier") || normalized === "on_order") {
    return PART_LOCATION.SUPPLIER;
  }
  if (normalized.includes("delivery_bay") || normalized.includes("loading_bay") || normalized.includes("delivery") || normalized.includes("at_delivery")) {
    return PART_LOCATION.LOADING_BAY;
  }
  if (normalized.includes("warehouse") || normalized.includes("storage")) {
    return PART_LOCATION.WAREHOUSE_STORAGE;
  }
  if (normalized.includes("technician") || normalized.includes("vehicle")) {
    return PART_LOCATION.VEHICLE;
  }
  if (normalized.includes("client") || normalized.includes("site")) {
    return PART_LOCATION.CLIENT_SITE;
  }
  
  return location;
}

/**
 * Map PO status to Part status
 * Ensures parts always reflect their linked PO's state
 */
export function mapPoStatusToPartStatus(poStatus) {
  if (!poStatus) return PART_STATUS.PENDING;
  
  const normalized = poStatus.toLowerCase().trim();
  
  switch (normalized) {
    case "draft":
      return PART_STATUS.PENDING;
    
    case "sent":
    case "on_order":
    case "on order":
      return PART_STATUS.ON_ORDER;
    
    case "in_transit":
    case "in transit":
    case "partially_received":
      return PART_STATUS.IN_TRANSIT;
    
    case "in_loading_bay":
    case "in loading bay":
    case "received":
    case "delivered":
      return PART_STATUS.IN_LOADING_BAY;
    
    case "in_storage":
    case "in storage":
      return PART_STATUS.IN_STORAGE;
    
    case "in_vehicle":
    case "in vehicle":
      return PART_STATUS.IN_VEHICLE;
    
    case "installed":
      return PART_STATUS.INSTALLED;
    
    case "cancelled":
      return PART_STATUS.PENDING;
    
    default:
      return PART_STATUS.PENDING;
  }
}