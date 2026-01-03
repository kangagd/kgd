import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    console.log('[fillAllVehicleStock] Starting, user:', user?.email);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    // Get all active vehicles
    const vehicles = await base44.entities.Vehicle.list();
    const activeVehicles = vehicles.filter(v => v.status === 'Active' || v.status === 'active');
    console.log('[fillAllVehicleStock] Found', activeVehicles.length, 'active vehicles');

    // Get all price list items with car_quantity > 0
    const priceListItems = await base44.entities.PriceListItem.list();
    const stockItems = priceListItems.filter(item => 
      item.track_inventory && 
      item.car_quantity && 
      item.car_quantity > 0 &&
      item.is_active !== false
    );
    console.log('[fillAllVehicleStock] Found', stockItems.length, 'items with car_quantity set');

    let totalUpdates = 0;
    const results = [];

    // For each vehicle, set stock to car_quantity
    for (const vehicle of activeVehicles) {
      console.log('[fillAllVehicleStock] Processing vehicle:', vehicle.name);
      const vehicleUpdates = [];
      
      // Get existing stock for this vehicle
      const existingStock = await base44.asServiceRole.entities.VehicleStock.filter({ 
        vehicle_id: vehicle.id 
      });
      console.log('[fillAllVehicleStock] Vehicle', vehicle.name, 'has', existingStock.length, 'existing stock records');

      for (const item of stockItems) {
        try {
          const existing = existingStock.find(vs => vs.product_id === item.id);
          const targetQuantity = item.car_quantity;

          if (existing) {
            // Update existing stock
            const currentQty = existing.quantity_on_hand || 0;
            if (currentQty !== targetQuantity) {
              console.log('[fillAllVehicleStock] Updating', item.item, 'from', currentQty, 'to', targetQuantity);
              await base44.asServiceRole.entities.VehicleStock.update(existing.id, {
                quantity_on_hand: targetQuantity
              });

            // Record movement
            await base44.asServiceRole.entities.VehicleStockMovement.create({
              vehicle_id: vehicle.id,
              price_list_item_id: item.id,
              item_name: item.item,
              movement_type: 'adjustment',
              quantity_change: targetQuantity - currentQty,
              previous_quantity: currentQty,
              new_quantity: targetQuantity,
              notes: 'Auto-fill to car_quantity (bulk operation)',
              moved_by: user.email,
              moved_by_name: user.full_name
            });

            vehicleUpdates.push({
              item: item.item,
              old: currentQty,
              new: targetQuantity
            });
            totalUpdates++;
            
            // Add delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          // Create new stock entry
          console.log('[fillAllVehicleStock] Creating new stock for', item.item, 'with quantity', targetQuantity);
          await base44.asServiceRole.entities.VehicleStock.create({
            vehicle_id: vehicle.id,
            product_id: item.id,
            product_name: item.item,
            sku: item.sku || '',
            category: item.category || '',
            quantity_on_hand: targetQuantity,
            minimum_target_quantity: targetQuantity
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
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        } catch (itemError) {
          console.error('[fillAllVehicleStock] Error processing item', item.item, 'for vehicle', vehicle.name, ':', itemError.message);
          throw itemError;
        }
      }

      results.push({
        vehicle: vehicle.name,
        updates: vehicleUpdates
      });
    }

    console.log('[fillAllVehicleStock] Complete! Total updates:', totalUpdates);
    return Response.json({ 
      success: true,
      vehicles_processed: activeVehicles.length,
      total_updates: totalUpdates,
      results
    });
  } catch (error) {
    console.error('[fillAllVehicleStock] Fatal error:', error.message);
    console.error('[fillAllVehicleStock] Stack:', error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});