import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Ensure Inventory Locations V2
 * 
 * Idempotently ensures canonical locations exist:
 * - WAREHOUSE_MAIN
 * - LOADING_BAY
 * - CONSUMED
 * 
 * Also ensures each Vehicle has an inventory_location_id.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Admin access required' 
      }, { status: 403 });
    }

    const result = {
      warehouse_main_id: null,
      loading_bay_id: null,
      consumed_id: null,
      created: [],
      updated: [],
      skipped: [],
      vehicle_locations_created: 0,
      vehicle_locations_updated: 0
    };

    // Get all existing locations
    const existingLocations = await base44.asServiceRole.entities.InventoryLocation.list();

    // 1. Ensure WAREHOUSE_MAIN
    let warehouseMain = existingLocations.find(loc => loc.location_code === 'WAREHOUSE_MAIN');
    
    if (!warehouseMain) {
      // Try to find existing warehouse without location_code
      const existingWarehouse = existingLocations.find(loc => 
        loc.type === 'warehouse' && !loc.location_code
      );

      if (existingWarehouse) {
        // Set location_code on existing warehouse
        await base44.asServiceRole.entities.InventoryLocation.update(existingWarehouse.id, {
          location_code: 'WAREHOUSE_MAIN',
          location_type: 'warehouse'
        });
        warehouseMain = await base44.asServiceRole.entities.InventoryLocation.get(existingWarehouse.id);
        result.updated.push('WAREHOUSE_MAIN (updated existing warehouse)');
      } else {
        // Create new warehouse
        warehouseMain = await base44.asServiceRole.entities.InventoryLocation.create({
          name: 'Main Warehouse',
          location_code: 'WAREHOUSE_MAIN',
          type: 'warehouse',
          location_type: 'warehouse',
          is_active: true
        });
        result.created.push('WAREHOUSE_MAIN');
      }
    } else {
      result.skipped.push('WAREHOUSE_MAIN (already exists)');
    }
    result.warehouse_main_id = warehouseMain.id;

    // 2. Ensure LOADING_BAY
    let loadingBay = existingLocations.find(loc => loc.location_code === 'LOADING_BAY');
    
    if (!loadingBay) {
      loadingBay = await base44.asServiceRole.entities.InventoryLocation.create({
        name: 'Loading Bay',
        location_code: 'LOADING_BAY',
        type: 'warehouse', // Use warehouse as base type
        location_type: 'loading_bay',
        is_active: true,
        description: 'Temporary staging area for incoming deliveries awaiting processing'
      });
      result.created.push('LOADING_BAY');
    } else {
      result.skipped.push('LOADING_BAY (already exists)');
    }
    result.loading_bay_id = loadingBay.id;

    // 3. Ensure CONSUMED
    let consumed = existingLocations.find(loc => loc.location_code === 'CONSUMED');
    
    if (!consumed) {
      consumed = await base44.asServiceRole.entities.InventoryLocation.create({
        name: 'Consumed',
        location_code: 'CONSUMED',
        type: 'warehouse', // Use warehouse as base type for compatibility
        location_type: 'virtual',
        is_active: true,
        description: 'Virtual location representing consumed/used items'
      });
      result.created.push('CONSUMED');
    } else {
      result.skipped.push('CONSUMED (already exists)');
    }
    result.consumed_id = consumed.id;

    // 4. Ensure Vehicle Locations
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    
    for (const vehicle of vehicles) {
      const vehicleCode = `VEHICLE_${vehicle.id}`;
      
      if (vehicle.inventory_location_id) {
        // Verify the location still exists
        try {
          await base44.asServiceRole.entities.InventoryLocation.get(vehicle.inventory_location_id);
          result.skipped.push(`Vehicle ${vehicle.name} (location already assigned)`);
        } catch {
          // Location doesn't exist, create new one
          const vehicleLocation = await base44.asServiceRole.entities.InventoryLocation.create({
            name: `Vehicle: ${vehicle.name}`,
            location_code: vehicleCode,
            type: 'vehicle',
            location_type: 'vehicle',
            vehicle_id: vehicle.id,
            assigned_technician_email: vehicle.assigned_user_id || null,
            assigned_technician_name: vehicle.assigned_user_name || null,
            is_active: true
          });

          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
            inventory_location_id: vehicleLocation.id,
            inventory_location_name: vehicleLocation.name
          });
          
          result.vehicle_locations_created++;
        }
      } else {
        // Check if location exists by code
        let vehicleLocation = existingLocations.find(loc => loc.location_code === vehicleCode);
        
        if (!vehicleLocation) {
          // Create new vehicle location
          vehicleLocation = await base44.asServiceRole.entities.InventoryLocation.create({
            name: `Vehicle: ${vehicle.name}`,
            location_code: vehicleCode,
            type: 'vehicle',
            location_type: 'vehicle',
            vehicle_id: vehicle.id,
            assigned_technician_email: vehicle.assigned_user_id || null,
            assigned_technician_name: vehicle.assigned_user_name || null,
            is_active: true
          });
          result.vehicle_locations_created++;
        }

        // Update vehicle with location ID
        await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
          inventory_location_id: vehicleLocation.id,
          inventory_location_name: vehicleLocation.name
        });
        result.vehicle_locations_updated++;
      }
    }

    return Response.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[ensureInventoryLocationsV2] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});