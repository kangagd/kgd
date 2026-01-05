/**
 * Part Configuration
 * Central source of truth for Part status and location values
 */

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

/**
 * STRICT RULES FOR INVENTORY READINESS
 * 
 * READY TO PICK means:
 * - The item is physically available
 * - AND can be assigned to a vehicle immediately
 * - AND requires no supplier interaction
 * 
 * An item is READY TO PICK if:
 * 1. status = "in_storage" (ready in warehouse) OR status = "in_vehicle" (already loaded)
 * 2. Must NOT be at supplier location
 * 3. If PO exists and has status, it must not be in draft/sent/on_order (must be received/delivered)
 * 
 * IMPORTANT: Parts with status "in_storage" are considered READY even without other checks,
 * as long as they're not still at the supplier location.
 */
export function isPartAvailable(part) {
  if (!part) return false;
  
  // RULE 1: Status must be in usable state (physically available)
  const hasUsableStatus = 
    part.status === PART_STATUS.IN_STORAGE || 
    part.status === PART_STATUS.IN_VEHICLE ||
    part.status === PART_STATUS.IN_LOADING_BAY; // Loading bay items are also ready to pick
  
  if (!hasUsableStatus) return false;
  
  // RULE 2: Must NOT be at supplier location
  if (part.location === PART_LOCATION.SUPPLIER) return false;
  
  // RULE 3: If linked to a PO, check PO status only if we have that information
  if (part.po_status) {
    const disallowedStatuses = ["draft", "sent", "on_order", "confirmed", "on order"];
    const normalizedPOStatus = part.po_status.toLowerCase().trim();
    if (disallowedStatuses.includes(normalizedPOStatus)) {
      return false;
    }
  }
  
  // If part is in_storage and not at supplier, it's ready
  // No need to check received_date - the status itself indicates it's been received
  return true;
}

/**
 * SHORTAGES LOGIC
 * 
 * An item appears under SHORTAGES if:
 * - Required quantity > available quantity
 * - OR status = "Pending"
 * - OR status = "On Order"
 * - OR any condition that makes it not Ready to Pick
 * 
 * Excludes: Cancelled and Installed items
 */
export function isPartShortage(part) {
  if (!part) return false;
  
  // Cancelled or installed parts are not shortages
  if (part.status === PART_STATUS.CANCELLED || part.status === PART_STATUS.INSTALLED) {
    return false;
  }
  
  // Explicitly treat "pending" and "on_order" as shortages
  if (part.status === PART_STATUS.PENDING || part.status === PART_STATUS.ON_ORDER) {
    return true;
  }
  
  // If not physically available, it's a shortage
  return !isPartAvailable(part);
}

export const PART_STATUS_OPTIONS = Object.values(PART_STATUS);

export const PART_STATUS_LABELS = {
  pending: "Pending",
  on_order: "On Order",
  in_transit: "In Transit",
  in_loading_bay: "In Loading Bay",
  at_supplier: "At Supplier",
  in_storage: "In Storage",
  in_vehicle: "In Vehicle",
  installed: "Installed",
  cancelled: "Cancelled",
};

export function getPartStatusLabel(status) {
  return PART_STATUS_LABELS[status] || status || "Unknown";
}

/**
 * PICKABLE STATUSES - Strict eligibility check for pick list
 * Parts can only appear in "Ready to Pick / Assigned" if their normalized status is in this set
 */
export const PICKABLE_STATUSES = new Set([
  PART_STATUS.IN_LOADING_BAY,
  PART_STATUS.IN_STORAGE,
  PART_STATUS.IN_VEHICLE,
]);

/**
 * Get normalized part status (always use this for status checks)
 * CRITICAL: Promotes part status based on linked PO status
 */
export function getNormalizedPartStatus(part) {
  if (!part) return PART_STATUS.PENDING;
  
  // First normalize the part's own status
  let status = normaliseLegacyPartStatus(part.status, part);
  
  // If part is already in a terminal/advanced state, don't downgrade
  if (status === PART_STATUS.IN_STORAGE || 
      status === PART_STATUS.IN_VEHICLE || 
      status === PART_STATUS.INSTALLED) {
    return status;
  }
  
  // Promote based on linked PO status if available
  const poStatus = part.po_status || part.purchase_order_status;
  if (poStatus) {
    const normalizedPoStatus = poStatus.toLowerCase().trim().replace(/\s+/g, '_');
    
    // Map PO status to Part status (promotion only)
    switch (normalizedPoStatus) {
      case 'in_storage':
      case 'instorage':
        return PART_STATUS.IN_STORAGE;
      
      case 'in_vehicle':
      case 'invehicle':
        return PART_STATUS.IN_VEHICLE;
      
      case 'installed':
        return PART_STATUS.INSTALLED;
      
      case 'in_loading_bay':
      case 'inloadingbay':
      case 'received':
      case 'delivered':
        // Only promote if part isn't already better positioned
        if (status === PART_STATUS.PENDING || status === PART_STATUS.ON_ORDER || status === PART_STATUS.IN_TRANSIT) {
          return PART_STATUS.IN_LOADING_BAY;
        }
        break;
      
      case 'in_transit':
      case 'intransit':
        // Only promote if part is still pending/ordered
        if (status === PART_STATUS.PENDING || status === PART_STATUS.ON_ORDER) {
          return PART_STATUS.IN_TRANSIT;
        }
        break;
      
      case 'on_order':
      case 'onorder':
      case 'sent':
        // Only promote from pending
        if (status === PART_STATUS.PENDING) {
          return PART_STATUS.ON_ORDER;
        }
        break;
    }
  }
  
  return status;
}

/**
 * Check if a part is pickable (can appear in "Ready to Pick / Assigned")
 * This is the single source of truth for pick list eligibility
 */
export function isPickablePart(part) {
  if (!part) return false;
  
  // Cancelled and installed parts are never pickable
  if (part.status === PART_STATUS.CANCELLED || part.status === PART_STATUS.INSTALLED) {
    return false;
  }
  
  const normalizedStatus = getNormalizedPartStatus(part);
  return PICKABLE_STATUSES.has(normalizedStatus);
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