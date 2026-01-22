/**
 * Canonical InventoryLocation resolver
 * Ensures deterministic location selection based on standardized `type` field
 */

const LOCATION_TYPES = {
    LOADING_BAY: 'loading_bay',
    WAREHOUSE: 'warehouse',
    VEHICLE: 'vehicle',
    SUPPLIER: 'supplier'
};

/**
 * Resolve core locations (loading bay + warehouse) by type
 * 
 * @param {Base44Client} base44 - Service role client
 * @returns {Promise<{loadingBayId, warehouseId}>} Resolved location IDs
 * @throws {Error} If required locations not found
 */
export async function resolveCoreLocations(base44) {
    try {
        const locations = await base44.asServiceRole.entities.InventoryLocation.list();
        
        if (!Array.isArray(locations) || locations.length === 0) {
            throw new Error('No InventoryLocations found in system');
        }

        // Find active loading bay
        const loadingBayLoc = locations.find(
            loc => loc.type === LOCATION_TYPES.LOADING_BAY && loc.is_active !== false
        );
        
        if (!loadingBayLoc) {
            throw new Error(`Missing active InventoryLocation with type="${LOCATION_TYPES.LOADING_BAY}"`);
        }

        // Find active warehouse
        const warehouseLoc = locations.find(
            loc => loc.type === LOCATION_TYPES.WAREHOUSE && loc.is_active !== false
        );
        
        if (!warehouseLoc) {
            throw new Error(`Missing active InventoryLocation with type="${LOCATION_TYPES.WAREHOUSE}"`);
        }

        return {
            loadingBayId: loadingBayLoc.id,
            loadingBayName: loadingBayLoc.name || 'Loading Bay',
            warehouseId: warehouseLoc.id,
            warehouseName: warehouseLoc.name || 'Warehouse Storage'
        };
    } catch (error) {
        console.error('[locationResolver] Error resolving core locations:', error.message);
        throw error;
    }
}

export { LOCATION_TYPES };