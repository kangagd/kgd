import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 1.2: Backfill InventoryQuantity from VehicleStock
 * Creates/updates InventoryQuantity records based on current VehicleStock data
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    // Get all vehicle stock records
    const vehicleStocks = await base44.asServiceRole.entities.VehicleStock.list();
    
    // Get all inventory locations (vehicles)
    const locations = await base44.asServiceRole.entities.InventoryLocation.filter({ type: 'vehicle' });
    const locationsByVehicleId = new Map(locations.map(loc => [loc.vehicle_id, loc]));

    // Get existing inventory quantities
    const existingQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();
    const quantityMap = new Map(
      existingQuantities.map(q => [`${q.location_id}_${q.price_list_item_id}`, q])
    );

    const results = {
      total_vehicle_stocks: vehicleStocks.length,
      to_create: [],
      to_update: [],
      created: [],
      updated: [],
      skipped: [],
      errors: []
    };

    for (const vStock of vehicleStocks) {
      const location = locationsByVehicleId.get(vStock.vehicle_id);
      
      if (!location) {
        results.skipped.push({
          vehicle_id: vStock.vehicle_id,
          reason: 'No InventoryLocation found for vehicle'
        });
        continue;
      }

      const key = `${location.id}_${vStock.product_id}`;
      const existingQty = quantityMap.get(key);

      const quantityData = {
        location_id: location.id,
        location_name: location.name,
        price_list_item_id: vStock.product_id,
        item_name: vStock.product_name,
        quantity: vStock.quantity_on_hand || 0,
        minimum_quantity: vStock.minimum_target_quantity || 0
      };

      if (existingQty) {
        // Update if different
        if (existingQty.quantity !== quantityData.quantity || 
            existingQty.minimum_quantity !== quantityData.minimum_quantity) {
          results.to_update.push({
            id: existingQty.id,
            current: existingQty.quantity,
            new: quantityData.quantity,
            location: location.name,
            item: vStock.product_name
          });

          if (!dryRun) {
            try {
              await base44.asServiceRole.entities.InventoryQuantity.update(existingQty.id, quantityData);
              results.updated.push({ id: existingQty.id, ...quantityData });
            } catch (err) {
              results.errors.push({
                id: existingQty.id,
                error: err.message
              });
            }
          }
        }
      } else {
        // Create new
        results.to_create.push({
          location: location.name,
          item: vStock.product_name,
          quantity: quantityData.quantity
        });

        if (!dryRun) {
          try {
            const created = await base44.asServiceRole.entities.InventoryQuantity.create(quantityData);
            results.created.push({ id: created.id, ...quantityData });
          } catch (err) {
            results.errors.push({
              vehicle_id: vStock.vehicle_id,
              product_id: vStock.product_id,
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
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});