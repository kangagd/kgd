import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 1.1: Create InventoryLocation records for all vehicles
 * Creates location records for vehicles that don't have them yet
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    // Get all vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    
    // Get all existing inventory locations
    const locations = await base44.asServiceRole.entities.InventoryLocation.list();
    const existingVehicleLocations = locations.filter(loc => loc.type === 'vehicle');
    const existingVehicleIds = new Set(existingVehicleLocations.map(loc => loc.vehicle_id));

    const results = {
      total_vehicles: vehicles.length,
      existing_locations: existingVehicleLocations.length,
      to_create: [],
      created: [],
      errors: []
    };

    // Create locations for vehicles that don't have them
    for (const vehicle of vehicles) {
      if (!existingVehicleIds.has(vehicle.id)) {
        const locationData = {
          name: vehicle.name,
          type: 'vehicle',
          vehicle_id: vehicle.id,
          is_active: vehicle.status === 'active',
          address_full: `Mobile - ${vehicle.name}`,
          notes: `Auto-created from vehicle migration`
        };

        results.to_create.push({
          vehicle_id: vehicle.id,
          vehicle_name: vehicle.name,
          location_data: locationData
        });

        if (!dryRun) {
          try {
            const location = await base44.asServiceRole.entities.InventoryLocation.create(locationData);
            results.created.push({
              vehicle_id: vehicle.id,
              location_id: location.id,
              name: location.name
            });
          } catch (err) {
            results.errors.push({
              vehicle_id: vehicle.id,
              error: err.message
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});