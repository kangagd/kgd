import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    // Get all active vehicles
    const vehicles = await base44.entities.Vehicle.list();
    const activeVehicles = vehicles.filter(v => v.status === 'Active' || v.status === 'active');

    // Get all price list items with car_quantity > 0
    const priceListItems = await base44.entities.PriceListItem.list();
    const stockItems = priceListItems.filter(item => 
      item.track_inventory && 
      item.car_quantity && 
      item.car_quantity > 0 &&
      item.is_active !== false
    );

    let totalUpdates = 0;
    const results = [];

    // For each vehicle, set stock to car_quantity
    for (const vehicle of activeVehicles) {
      const vehicleUpdates = [];
      
      // Get existing stock for this vehicle
      const existingStock = await base44.asServiceRole.entities.VehicleStock.filter({ 
        vehicle_id: vehicle.id 
      });

      for (const item of stockItems) {
        const existing = existingStock.find(vs => vs.price_list_item_id === item.id);
        const targetQuantity = item.car_quantity;

        if (existing) {
          // Update existing stock
          if (existing.quantity !== targetQuantity) {
            const previousQty = existing.quantity || 0;
            await base44.asServiceRole.entities.VehicleStock.update(existing.id, {
              quantity: targetQuantity
            });

            // Record movement
            await base44.asServiceRole.entities.VehicleStockMovement.create({
              vehicle_id: vehicle.id,
              price_list_item_id: item.id,
              item_name: item.item,
              movement_type: 'adjustment',
              quantity_change: targetQuantity - previousQty,
              previous_quantity: previousQty,
              new_quantity: targetQuantity,
              notes: 'Auto-fill to car_quantity (bulk operation)',
              moved_by: user.email,
              moved_by_name: user.full_name
            });

            vehicleUpdates.push({
              item: item.item,
              old: previousQty,
              new: targetQuantity
            });
            totalUpdates++;
          }
        } else {
          // Create new stock entry
          await base44.asServiceRole.entities.VehicleStock.create({
            vehicle_id: vehicle.id,
            price_list_item_id: item.id,
            item_name: item.item,
            quantity: targetQuantity
          });

          // Record movement
          await base44.asServiceRole.entities.VehicleStockMovement.create({
            vehicle_id: vehicle.id,
            price_list_item_id: item.id,
            item_name: item.item,
            movement_type: 'adjustment',
            quantity_change: targetQuantity,
            previous_quantity: 0,
            new_quantity: targetQuantity,
            notes: 'Auto-fill to car_quantity (bulk operation)',
            moved_by: user.email,
            moved_by_name: user.full_name
          });

          vehicleUpdates.push({
            item: item.item,
            old: 0,
            new: targetQuantity
          });
          totalUpdates++;
        }
      }

      results.push({
        vehicle: vehicle.name,
        updates: vehicleUpdates
      });
    }

    return Response.json({ 
      success: true,
      vehicles_processed: activeVehicles.length,
      total_updates: totalUpdates,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});