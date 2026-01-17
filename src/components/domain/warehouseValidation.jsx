/**
 * Warehouse Validation Helpers
 * 
 * Enforces single-active-warehouse constraint in UI and prevents
 * duplicate warehouse creation during admin operations.
 */

import { validateSingleActiveWarehouse } from '@/functions/validateWarehouseCreation';
import { base44 } from '@/api/base44Client';

/**
 * Check if a warehouse location is safe to activate
 * 
 * @param {string} locationId InventoryLocation ID to activate
 * @returns {Promise<{canActivate: boolean, reason?: string}>}
 */
export async function canActivateWarehouse(locationId) {
  try {
    const result = await base44.functions.invoke('validateWarehouseCreation', {
      exclude_location_id: locationId
    });
    
    return {
      canActivate: result.valid,
      reason: result.message,
      activeWarehouses: result.activeWarehouses
    };
  } catch (error) {
    return {
      canActivate: false,
      reason: `Validation error: ${error.message}`
    };
  }
}

/**
 * Filter locations to show only active ones in dropdowns
 * This ensures the legacy duplicate warehouse never appears to users
 * 
 * @param {Array} locations InventoryLocation records
 * @returns {Array} Filtered locations (is_active !== false)
 */
export function getActiveLocations(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations.filter(loc => loc.is_active !== false);
}

/**
 * Filter locations to show only active warehouses
 * For warehouse-specific dropdowns (e.g., PO receive location)
 * 
 * @param {Array} locations InventoryLocation records
 * @returns {Array} Filtered active warehouse locations
 */
export function getActiveWarehouses(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations
    .filter(loc => loc.is_active !== false)
    .filter(loc => {
      const type = String(loc.type || '').toLowerCase().trim();
      return type === 'warehouse';
    });
}

/**
 * Get the canonical (first active) warehouse for default operations
 * 
 * @param {Array} locations InventoryLocation records
 * @returns {Object|null} The canonical warehouse or null
 */
export function getCanonicalWarehouse(locations = []) {
  const activeWarehouses = getActiveWarehouses(locations);
  return activeWarehouses.length > 0 ? activeWarehouses[0] : null;
}

/**
 * Show deprecation warning if a legacy warehouse is encountered
 * (for backward compatibility checks in admin tools)
 * 
 * @param {Array} locations InventoryLocation records
 * @returns {Array} Legacy (inactive) warehouse locations
 */
export function getLegacyWarehouses(locations = []) {
  if (!Array.isArray(locations)) return [];
  return locations
    .filter(loc => loc.is_active === false)
    .filter(loc => {
      const type = String(loc.type || '').toLowerCase().trim();
      return type === 'warehouse';
    });
}