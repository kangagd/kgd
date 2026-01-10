import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    let locationsCreated = 0;
    let quantitiesLinked = 0;

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
          assigned_technician_email: vehicle.assigned_user_email,
          assigned_technician_name: vehicle.assigned_user_name,
          is_active: true,
          description: `Stock location for vehicle ${vehicle.name}`
        });
        locationId = newLoc.id;
        locationsCreated++;
      }

      // Find any InventoryQuantity records with location_name matching vehicle name
      // and link them to this location_id
      const allQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();
      for (const qty of allQuantities) {
        if (qty.location_name === vehicle.name && (!qty.location_id || qty.location_id !== locationId)) {
          await base44.asServiceRole.entities.InventoryQuantity.update(qty.id, {
            location_id: locationId,
            location_type: 'vehicle'
          });
          quantitiesLinked++;
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