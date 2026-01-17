import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Guard: Admin only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all active vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('name');
    const activeVehicles = vehicles.filter(v => v.status === 'Active' || !v.status);

    const result = {
      vehicles_checked: activeVehicles.length,
      created_count: 0,
      already_exists_count: 0,
      errors: [],
      created_ids: [],
      success: true
    };

    // For each vehicle, ensure InventoryLocation exists
    for (const vehicle of activeVehicles) {
      try {
        // Check if location already exists
        const existing = await base44.asServiceRole.entities.InventoryLocation.filter({
          type: 'vehicle',
          vehicle_id: vehicle.id
        });

        if (existing.length > 0) {
          result.already_exists_count += 1;
        } else {
          // Create new vehicle location
          const newLocation = await base44.asServiceRole.entities.InventoryLocation.create({
            type: 'vehicle',
            vehicle_id: vehicle.id,
            name: vehicle.name,
            is_active: true
          });
          result.created_count += 1;
          result.created_ids.push(newLocation.id);
        }
      } catch (err) {
        result.errors.push({
          vehicle_id: vehicle.id,
          vehicle_name: vehicle.name,
          error: err.message
        });
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error('ensureVehicleInventoryLocations error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});