import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load all vehicles and inventory locations
    const [vehicles, allLocations] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.InventoryLocation.list()
    ]);

    // Load InventoryQuantity to find which locations have stock
    const allQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();
    const locationWithStock = new Set(
      allQuantities
        .filter(q => q.location_id && q.quantity > 0)
        .map(q => q.location_id)
    );

    const results = {
      linked: [],
      created: [],
      duplicates_deactivated: [],
      errors: []
    };

    // Process each vehicle
    for (const vehicle of vehicles) {
      try {
        // A) Check if already linked
        let linkedLocation = allLocations.find(
          l => l.vehicle_id === vehicle.id && l.type === 'vehicle'
        );

        if (linkedLocation) {
          results.linked.push({
            vehicle_id: vehicle.id,
            vehicle_name: vehicle.name,
            location_id: linkedLocation.id,
            location_name: linkedLocation.name,
            action: 'already_linked'
          });
          continue;
        }

        // B) Find by name (case-insensitive) or rego
        const candidatesByName = allLocations.filter(
          l =>
            l.type === 'vehicle' &&
            !l.vehicle_id &&
            l.name?.toLowerCase() === vehicle.name?.toLowerCase()
        );

        let found = candidatesByName[0];

        if (!found && vehicle.registration_plate) {
          const candidatesByRego = allLocations.filter(
            l =>
              l.type === 'vehicle' &&
              !l.vehicle_id &&
              l.name?.toLowerCase().includes(vehicle.registration_plate?.toLowerCase())
          );
          found = candidatesByRego[0];
        }

        if (found) {
          // C) Update the location to link it
          await base44.asServiceRole.entities.InventoryLocation.update(found.id, {
            vehicle_id: vehicle.id
          });

          results.linked.push({
            vehicle_id: vehicle.id,
            vehicle_name: vehicle.name,
            location_id: found.id,
            location_name: found.name,
            action: 'linked_by_match'
          });

          linkedLocation = { ...found, vehicle_id: vehicle.id };
        } else {
          // D) Create new location
          const newLoc = await base44.asServiceRole.entities.InventoryLocation.create({
            name: vehicle.name,
            type: 'vehicle',
            vehicle_id: vehicle.id,
            is_active: true,
            description: `Auto-created for vehicle ${vehicle.name}`
          });

          results.created.push({
            vehicle_id: vehicle.id,
            vehicle_name: vehicle.name,
            location_id: newLoc.id,
            location_name: newLoc.name
          });

          linkedLocation = newLoc;
        }

        // After linking, check for duplicates (multiple locations for this vehicle)
        const allLocationsForVehicle = allLocations.filter(
          l => l.vehicle_id === vehicle.id && l.type === 'vehicle'
        );

        if (allLocationsForVehicle.length > 1) {
          // Pick the one with stock, or the most recent, or the first
          const locWithStock = allLocationsForVehicle.find(l =>
            locationWithStock.has(l.id)
          );
          const preferred = locWithStock || linkedLocation;

          // Deactivate the others
          for (const dupLoc of allLocationsForVehicle) {
            if (dupLoc.id !== preferred.id && dupLoc.is_active !== false) {
              await base44.asServiceRole.entities.InventoryLocation.update(dupLoc.id, {
                is_active: false,
                description: (dupLoc.description || '') + ' [duplicate vehicle location - deactivated]'
              });

              results.duplicates_deactivated.push({
                location_id: dupLoc.id,
                location_name: dupLoc.name,
                vehicle_id: vehicle.id,
                vehicle_name: vehicle.name
              });
            }
          }
        }
      } catch (err) {
        results.errors.push({
          vehicle_id: vehicle.id,
          vehicle_name: vehicle.name,
          error: err.message
        });
      }
    }

    return Response.json({
      success: true,
      summary: {
        vehicles_processed: vehicles.length,
        linked: results.linked.length,
        created: results.created.length,
        duplicates_deactivated: results.duplicates_deactivated.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});