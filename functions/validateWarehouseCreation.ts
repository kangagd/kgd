import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validates that no more than one ACTIVE warehouse exists.
 * Prevents accidental creation of duplicate active warehouses.
 * 
 * Use this in any admin tool or API that creates/activates InventoryLocation records.
 * 
 * @param {Object} base44 SDK client
 * @param {string} excludeLocationId (optional) Location ID to exclude from check (for updates)
 * @returns {Object} { valid: boolean, message: string, activeWarehouses: Array }
 */
export async function validateSingleActiveWarehouse(base44, excludeLocationId = null) {
  try {
    const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
    
    const activeWarehouses = allLocations.filter(loc => {
      // Skip the location being updated (for edit operations)
      if (excludeLocationId && loc.id === excludeLocationId) return false;
      
      // Only count active warehouses
      if (loc.is_active === false) return false;
      
      const typeNormalized = String(loc.type || '').toLowerCase().trim();
      return typeNormalized === 'warehouse';
    });

    if (activeWarehouses.length > 1) {
      return {
        valid: false,
        message: `Cannot create/activate warehouse: ${activeWarehouses.length} active warehouses already exist. Retire all but one first.`,
        activeWarehouses: activeWarehouses.map(w => ({
          id: w.id,
          name: w.name,
          is_active: w.is_active
        }))
      };
    }

    return {
      valid: true,
      message: 'Warehouse creation/activation is allowed',
      activeWarehouses: activeWarehouses
    };
  } catch (error) {
    return {
      valid: false,
      message: `Validation error: ${error.message}`,
      activeWarehouses: []
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { exclude_location_id } = payload;

    const result = await validateSingleActiveWarehouse(base44, exclude_location_id);

    if (!result.valid) {
      return Response.json(result, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});