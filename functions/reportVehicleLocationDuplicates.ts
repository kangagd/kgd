import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Report duplicate vehicle InventoryLocation records for debugging.
 * Returns groups where active count > 1 with full row list.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only operation
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all active vehicle locations
    const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'vehicle',
      vehicle_id: { $exists: true, $ne: null },
      is_active: true
    });

    // Group by vehicle_id
    const groupsByVehicleId = new Map();
    for (const loc of vehicleLocations) {
      const vehicleId = loc.vehicle_id;
      if (!groupsByVehicleId.has(vehicleId)) {
        groupsByVehicleId.set(vehicleId, []);
      }
      groupsByVehicleId.get(vehicleId).push({
        id: loc.id,
        name: loc.name,
        location_code: loc.location_code,
        vehicle_id: loc.vehicle_id,
        created_date: loc.created_date,
        updated_date: loc.updated_date
      });
    }

    // Find groups with duplicates
    const duplicateGroups = [];
    for (const [vehicleId, locations] of groupsByVehicleId.entries()) {
      if (locations.length > 1) {
        duplicateGroups.push({
          vehicle_id: vehicleId,
          duplicate_count: locations.length,
          locations: locations
        });
      }
    }

    return Response.json({
      status: 'SUCCESS',
      total_vehicle_groups: groupsByVehicleId.size,
      groups_with_duplicates: duplicateGroups.length,
      duplicate_groups: duplicateGroups,
      summary: duplicateGroups.length > 0
        ? `Found ${duplicateGroups.length} vehicles with duplicate active locations`
        : 'No duplicate vehicle locations found'
    });

  } catch (error) {
    console.error('reportVehicleLocationDuplicates error:', error);
    return Response.json({ 
      error: error.message,
      status: 'ERROR'
    }, { status: 500 });
  }
});