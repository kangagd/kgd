import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfills InventoryQuantity for warehouse locations from PriceListItem.stock_level
 * 
 * Strategy:
 * - Gets all warehouse locations (supports multiple)
 * - Uses is_primary flag to determine which warehouse gets the stock
 * - Migrates PriceListItem.stock_level into InventoryQuantity records
 * - Creates records for items with track_inventory=true and stock_level > 0
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { dryRun = true, targetWarehouseId = null } = body;

    // Get all warehouse locations
    const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'warehouse',
      is_active: true
    });

    if (warehouses.length === 0) {
      return Response.json({ 
        error: 'No warehouse locations found. Create one first using createWarehouseLocation.' 
      }, { status: 400 });
    }

    // Determine target warehouse (use specified, or primary, or first)
    let targetWarehouse;
    if (targetWarehouseId) {
      targetWarehouse = warehouses.find(w => w.id === targetWarehouseId);
      if (!targetWarehouse) {
        return Response.json({ error: 'Specified warehouse not found' }, { status: 404 });
      }
    } else {
      targetWarehouse = warehouses.find(w => w.is_primary) || warehouses[0];
    }

    console.log(`Using warehouse: ${targetWarehouse.name} (${targetWarehouse.id})`);

    // Get all price list items with inventory tracking
    const allItems = await base44.asServiceRole.entities.PriceListItem.list();
    const trackableItems = allItems.filter(item => 
      item.track_inventory !== false && (item.stock_level || 0) > 0
    );

    console.log(`Found ${trackableItems.length} items with stock to migrate`);

    // Get existing InventoryQuantity records for this warehouse
    const existingQuantities = await base44.asServiceRole.entities.InventoryQuantity.filter({
      location_id: targetWarehouse.id
    });
    const existingMap = new Map(existingQuantities.map(q => [q.price_list_item_id, q]));

    const results = {
      toCreate: [],
      toUpdate: [],
      skipped: [],
      errors: []
    };

    // Process each item
    for (const item of trackableItems) {
      try {
        const stockLevel = item.stock_level || 0;
        const existing = existingMap.get(item.id);

        if (existing) {
          // Record exists - check if needs update
          if (existing.quantity !== stockLevel) {
            results.toUpdate.push({
              item_name: item.item,
              current_quantity: existing.quantity,
              new_quantity: stockLevel,
              quantity_id: existing.id
            });

            if (!dryRun) {
              await base44.asServiceRole.entities.InventoryQuantity.update(existing.id, {
                quantity: stockLevel,
                item_name: item.item
              });
            }
          } else {
            results.skipped.push({
              item_name: item.item,
              quantity: stockLevel,
              reason: 'Already exists with correct quantity'
            });
          }
        } else {
          // Need to create new record
          results.toCreate.push({
            item_name: item.item,
            quantity: stockLevel,
            location: targetWarehouse.name
          });

          if (!dryRun) {
            await base44.asServiceRole.entities.InventoryQuantity.create({
              price_list_item_id: item.id,
              item_name: item.item,
              location_id: targetWarehouse.id,
              location_name: targetWarehouse.name,
              quantity: stockLevel,
              min_quantity: item.min_stock_level || 0
            });
          }
        }
      } catch (err) {
        console.error(`Error processing item ${item.item}:`, err);
        results.errors.push({
          item_name: item.item,
          error: err.message
        });
      }
    }

    return Response.json({
      success: true,
      dryRun: dryRun,
      warehouse: {
        id: targetWarehouse.id,
        name: targetWarehouse.name
      },
      summary: {
        total_items_processed: trackableItems.length,
        to_create: results.toCreate.length,
        to_update: results.toUpdate.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      details: results
    });

  } catch (error) {
    console.error('Backfill warehouse inventory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});