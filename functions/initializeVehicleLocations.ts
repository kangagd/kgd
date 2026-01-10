import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all vehicles and all quantities
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const allQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();
    
    let locationsCreated = 0;
    let quantitiesLinked = 0;

    // Get unique vehicle location names from InventoryQuantity records
    const vehicleLocationNames = new Set();
    for (const qty of allQuantities) {
      if (qty.location_name && !qty.location_id) {
        vehicleLocationNames.add(qty.location_name);
      }
    }

    // Process each vehicle
    for (const vehicle of vehicles) {
      // Check if location already exists
      const existing = await base44.asServiceRole.entities.InventoryLocation.filter({
        vehicle_id: vehicle.id,
        type: 'vehicle'
      });

      let locationId;
      if (existing.length > 0) {
        locationId = existing[0].id;
      } else {
        // Create new location
        const newLoc = await base44.asServiceRole.entities.InventoryLocation.create({
          name: vehicle.name,
          type: 'vehicle',
          vehicle_id: vehicle.id,
          is_active: true,
          description: `Stock location for vehicle ${vehicle.name}`
        });
        locationId = newLoc.id;
        locationsCreated++;
      }

      // Link quantities with matching location_name to this location
      for (const qty of allQuantities) {
        if (qty.location_name === vehicle.name && (!qty.location_id || qty.location_id !== locationId)) {
          await base44.asServiceRole.entities.InventoryQuantity.update(qty.id, {
            location_id: locationId
          });
          quantitiesLinked++;
        }
      }
    }

    // Create locations for any orphaned vehicle names not matching vehicles
    for (const vehicleName of vehicleLocationNames) {
      const matchingVehicle = vehicles.find(v => v.name === vehicleName);
      if (!matchingVehicle) {
        // Create a generic vehicle location for this name
        const newLoc = await base44.asServiceRole.entities.InventoryLocation.create({
          name: vehicleName,
          type: 'vehicle',
          is_active: true,
          description: `Stock location for ${vehicleName}`
        });
        locationsCreated++;

        // Link quantities with this location_name
        for (const qty of allQuantities) {
          if (qty.location_name === vehicleName && !qty.location_id) {
            await base44.asServiceRole.entities.InventoryQuantity.update(qty.id, {
              location_id: newLoc.id
            });
            quantitiesLinked++;
          }
        }
      }
    }

    return Response.json({
      success: true,
      locationsCreated,
      quantitiesLinked,
      message: `Created ${locationsCreated} vehicle locations and linked ${quantitiesLinked} quantities`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});