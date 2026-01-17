/**
 * Single source of truth for InventoryLocation type normalization and filtering.
 * Ensures consistent handling of physical vs. future locations across all UIs.
 * 
 * STRATEGY A: On-hand inventory is ONLY at physical available locations (warehouse + vehicles).
 * Future locations (supplier, loading bay, in-transit) are inbound commitments only.
 */

/**
 * Normalize location type to canonical lowercase value
 * Handles legacy casing: "Warehouse" → "warehouse", "VEHICLE" → "vehicle"
 * 
 * @param {string} type Raw type from InventoryLocation record
 * @returns {string} Normalized type: "warehouse" | "vehicle" | "other"
 */
export function normalizeLocationType(type) {
  if (!type) return 'other';
  const lower = String(type).toLowerCase().trim();
  if (lower === 'warehouse') return 'warehouse';
  if (lower === 'vehicle') return 'vehicle';
  return 'other';
}

/**
 * Check if location is physically available for stock on-hand operations
 * 
 * @param {Object} location InventoryLocation record
 * @returns {boolean} True iff location is active warehouse or vehicle
 */
export function isPhysicalAvailableLocation(location) {
  if (!location) return false;
  
  // Respect is_active flag (default to true if missing)
  if (location.is_active === false) return false;
  
  // Only warehouse and vehicle are physical available locations
  const normalized = normalizeLocationType(location.type);
  return ['warehouse', 'vehicle'].includes(normalized);
}

/**
 * Get the first active warehouse location
 * Use this for default PO receive locations instead of hardcoded type checks
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @returns {Object|null} First active warehouse or null
 */
export function getDefaultWarehouseLocation(locations = []) {
  if (!Array.isArray(locations)) return null;
  return locations.find(loc => 
    isPhysicalAvailableLocation(loc) && 
    normalizeLocationType(loc.type) === 'warehouse'
  ) || null;
}

/**
 * Find active vehicle location by vehicle ID
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @param {string} vehicleId Vehicle ID to match
 * @returns {Object|null} Active vehicle location or null
 */
export function getVehicleLocationByVehicleId(locations = [], vehicleId) {
  if (!Array.isArray(locations) || !vehicleId) return null;
  return locations.find(loc => 
    isPhysicalAvailableLocation(loc) && 
    normalizeLocationType(loc.type) === 'vehicle' &&
    loc.vehicle_id === vehicleId
  ) || null;
}

/**
 * Filter locations to only physical available ones (for day-to-day stock operations)
 * Future/conceptual locations (supplier, loading bay, in-transit) are excluded
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @returns {Array} Filtered locations (warehouse + vehicles)
 */
export function getPhysicalAvailableLocations(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations.filter(isPhysicalAvailableLocation);
}

/**
 * Get all locations for admin/config views (does not filter by physical/active)
 * Use this only in admin settings, not in day-to-day dropdowns
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @returns {Array} All locations with normalized types
 */
export function getAllLocationsWithNormalizedTypes(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations.map(loc => ({
    ...loc,
    type_normalized: normalizeLocationType(loc.type),
    is_physical: isPhysicalAvailableLocation(loc)
  }));
}

/**
 * Calculate on-hand quantity for a SKU, only from physical available locations
 * This prevents future/in-transit locations from contaminating on-hand totals
 * 
 * @param {Array} quantities Array of InventoryQuantity records
 * @param {Array} locations Array of InventoryLocation records
 * @param {string} skuId PriceListItem ID
 * @returns {number} Total on-hand quantity
 */
export function calculateOnHandFromPhysicalLocations(quantities = [], locations = [], skuId) {
  if (!Array.isArray(quantities) || !Array.isArray(locations) || !skuId) return 0;
  
  const physicalLocationIds = new Set(
    locations
      .filter(isPhysicalAvailableLocation)
      .map(loc => loc.id)
  );
  
  return quantities
    .filter(q => q.price_list_item_id === skuId && physicalLocationIds.has(q.location_id))
    .reduce((sum, q) => sum + (q.quantity || 0), 0);
}