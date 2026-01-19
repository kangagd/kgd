/**
 * Inventory Location Lookup Helpers
 * Resolves special locations by name, type, and vehicle ID
 * Always returns InventoryLocation.id (canonical reference)
 */

/**
 * Get Loading Bay location ID
 * Used in logistics outcomes to resolve "Loading Bay" → InventoryLocation.id
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @returns {string|null} Loading Bay location ID or null
 */
export function getLoadingBayLocationId(locations = []) {
  if (!Array.isArray(locations)) return null;
  const bay = locations.find(loc => 
    loc.type === 'warehouse' && 
    loc.name && 
    loc.name.toLowerCase().includes('loading') &&
    loc.is_active !== false
  );
  return bay?.id || null;
}

/**
 * Get main warehouse location ID
 * Used for default PO receive destination
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @returns {string|null} Main warehouse location ID or null
 */
export function getMainWarehouseLocationId(locations = []) {
  if (!Array.isArray(locations)) return null;
  const warehouse = locations.find(loc => 
    loc.type === 'warehouse' && 
    loc.is_active !== false
  );
  return warehouse?.id || null;
}

/**
 * Get vehicle location ID by vehicle_id
 * Used when moving parts to a specific vehicle
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @param {string} vehicleId Vehicle ID to match
 * @returns {string|null} Vehicle location ID or null
 */
export function getVehicleLocationIdForVehicle(locations = [], vehicleId) {
  if (!Array.isArray(locations) || !vehicleId) return null;
  const vehicleLoc = locations.find(loc => 
    loc.type === 'vehicle' && 
    loc.vehicle_id === vehicleId &&
    loc.is_active !== false
  );
  return vehicleLoc?.id || null;
}

/**
 * Get location by name (case-insensitive)
 * Generic lookup for any named location
 * 
 * @param {Array} locations Array of InventoryLocation records
 * @param {string} name Location name to search for
 * @returns {string|null} Location ID or null
 */
export function getLocationIdByName(locations = [], name) {
  if (!Array.isArray(locations) || !name) return null;
  const loc = locations.find(l => 
    l.name && 
    l.name.toLowerCase() === name.toLowerCase() &&
    l.is_active !== false
  );
  return loc?.id || null;
}