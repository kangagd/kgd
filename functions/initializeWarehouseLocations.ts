import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Initialize warehouse locations and migrate current vehicle stock to InventoryQuantity
 * Phase 1: Foundation - Create warehouse locations and dual-write system setup
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can initialize
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, warehouse_name, warehouse_description } = body;

    // Action 1: Create warehouse location
    if (action === 'create_warehouse') {
      if (!warehouse_name) {
        return Response.json({ error: 'warehouse_name required' }, { status: 400 });
      }

      const warehouse = await base44.asServiceRole.entities.InventoryLocation.create({
        name: warehouse_name,
        type: 'warehouse',
        description: warehouse_description || '',
        is_active: true
      });

      return Response.json({
        success: true,
        warehouse: warehouse,
        message: `Warehouse "${warehouse_name}" created`
      });
    }

    // Action 2: Migrate vehicle stock to InventoryQuantity
    if (action === 'migrate_vehicle_stock') {
      console.log('[initializeWarehouse] Starting vehicle stock migration...');

      // Get all vehicles with stock
      const vehicles = await base44.asServiceRole.entities.Vehicle.list();
      
      let migratedCount = 0;
      let errors = [];

      for (const vehicle of vehicles) {
        try {
          // Get vehicle stock items
          const stockItems = await base44.asServiceRole.entities.VehicleStock.filter({
            vehicle_id: vehicle.id
          });

          if (stockItems.length === 0) continue;

          // Get or create vehicle location
          let vehicleLocation = await base44.asServiceRole.entities.InventoryLocation.filter({
            vehicle_id: vehicle.id,
            type: 'vehicle'
          });

          if (vehicleLocation.length === 0) {
            vehicleLocation = await base44.asServiceRole.entities.InventoryLocation.create({
              name: vehicle.name || `Vehicle ${vehicle.id}`,
              type: 'vehicle',
              vehicle_id: vehicle.id,
              is_active: true
            });
          } else {
            vehicleLocation = vehicleLocation[0];
          }

          // Create InventoryQuantity for each stock item
          for (const stock of stockItems) {
            const existingQuantity = await base44.asServiceRole.entities.InventoryQuantity.filter({
              price_list_item_id: stock.price_list_item_id,
              location_id: vehicleLocation.id
            });

            if (existingQuantity.length === 0) {
              // Get item name for caching
              const item = await base44.asServiceRole.entities.PriceListItem.get(stock.price_list_item_id);

              await base44.asServiceRole.entities.InventoryQuantity.create({
                price_list_item_id: stock.price_list_item_id,
                location_id: vehicleLocation.id,
                quantity: stock.quantity_on_hand || 0,
                item_name: item?.item || 'Unknown',
                location_name: vehicleLocation.name
              });
            } else {
              // Update existing quantity
              await base44.asServiceRole.entities.InventoryQuantity.update(
                existingQuantity[0].id,
                {
                  quantity: stock.quantity_on_hand || 0
                }
              );
            }

            migratedCount++;
          }
        } catch (err) {
          errors.push(`Vehicle ${vehicle.id}: ${err.message}`);
        }
      }

      return Response.json({
        success: true,
        migratedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Migrated ${migratedCount} stock items to InventoryQuantity`
      });
    }

    // Action 3: Populate warehouse quantities
    if (action === 'populate_warehouse_quantities') {
      const { location_id, quantities } = body;

      if (!location_id || !Array.isArray(quantities)) {
        return Response.json({ 
          error: 'location_id and quantities array required' 
        }, { status: 400 });
      }

      let populatedCount = 0;
      let errors = [];

      for (const qty of quantities) {
        try {
          const { price_list_item_id, quantity } = qty;
          
          const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
            price_list_item_id,
            location_id
          });

          const item = await base44.asServiceRole.entities.PriceListItem.get(price_list_item_id);
          const location = await base44.asServiceRole.entities.InventoryLocation.get(location_id);

          if (existing.length === 0) {
            await base44.asServiceRole.entities.InventoryQuantity.create({
              price_list_item_id,
              location_id,
              quantity,
              item_name: item?.item,
              location_name: location?.name
            });
          } else {
            await base44.asServiceRole.entities.InventoryQuantity.update(
              existing[0].id,
              { quantity }
            );
          }

          populatedCount++;
        } catch (err) {
          errors.push(`Item ${qty.price_list_item_id}: ${err.message}`);
        }
      }

      return Response.json({
        success: true,
        populatedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // Action 4: Assign technician to vehicle location
    if (action === 'assign_technician') {
      const { location_id, technician_email } = body;

      if (!location_id || !technician_email) {
        return Response.json({ 
          error: 'location_id and technician_email required' 
        }, { status: 400 });
      }

      const location = await base44.asServiceRole.entities.InventoryLocation.get(location_id);
      
      if (location.type !== 'vehicle') {
        return Response.json({
          error: 'Can only assign technicians to vehicle locations'
        }, { status: 400 });
      }

      // Get technician info
      const technician = await base44.asServiceRole.entities.User.filter({
        email: technician_email
      });

      if (technician.length === 0) {
        return Response.json({
          error: `Technician ${technician_email} not found`
        }, { status: 400 });
      }

      // Update location with technician
      await base44.asServiceRole.entities.InventoryLocation.update(location_id, {
        assigned_technician_email: technician_email,
        assigned_technician_name: technician[0].display_name || technician[0].full_name
      });

      return Response.json({
        success: true,
        message: `Technician assigned to ${location.name}`
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[initializeWarehouse] Error:', error);
    return Response.json({ 
      error: error.message, 
      stage: 'execution'
    }, { status: 500 });
  }
});