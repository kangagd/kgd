import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * inventoryReferenceMigration - Restore referential integrity using SKU
 *
 * Admin-only function to fix orphaned InventoryQuantity and broken StockMovement records.
 * Uses SKU as the stable matching key; never guesses or auto-matches by name.
 *
 * Dry-run first, then apply if safe.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden: Admin access required',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const { dryRun = true } = await req.json();

    console.log(`[inventoryReferenceMigration] Starting (dryRun=${dryRun})`);

    // Guard: prevent writes if dryRun is true
    if (dryRun) {
      const originalCreate = base44.asServiceRole.entities.InventoryQuantity.create;
      const originalUpdate = base44.asServiceRole.entities.InventoryQuantity.update;
      base44.asServiceRole.entities.InventoryQuantity.create = async () => {
        throw new Error('Dry-run mode: no writes allowed');
      };
      base44.asServiceRole.entities.InventoryQuantity.update = async () => {
        throw new Error('Dry-run mode: no writes allowed');
      };
      // Same for StockMovement
      base44.asServiceRole.entities.StockMovement.update = async () => {
        throw new Error('Dry-run mode: no writes allowed');
      };
    }

    // ========================================
    // Step 1: Build lookup maps
    // ========================================
    const allPriceListItems = await base44.asServiceRole.entities.PriceListItem.list();
    const skuMap = new Map(); // sku → PriceListItem
    allPriceListItems.forEach(item => {
      if (item.sku) {
        skuMap.set(item.sku.toLowerCase(), item);
      }
    });

    const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
    const locationByVehicleId = new Map(); // vehicle_id → InventoryLocation
    const locationByWarehouseId = new Map(); // warehouse_id → InventoryLocation
    const locationByType = new Map(); // type → [InventoryLocation]

    allLocations.forEach(loc => {
      if (loc.vehicle_id) {
        locationByVehicleId.set(loc.vehicle_id, loc);
      }
      if (loc.warehouse_id) {
        locationByWarehouseId.set(loc.warehouse_id, loc);
      }
      if (loc.type) {
        if (!locationByType.has(loc.type)) {
          locationByType.set(loc.type, []);
        }
        locationByType.get(loc.type).push(loc);
      }
    });

    const mainWarehouse = Array.from(locationByType.get('warehouse') || []).find(l => !l.vehicle_id);

    // ========================================
    // Step 2: Fix orphaned InventoryQuantity records
    // ========================================
    const allQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();
    let qtyResolved = 0;
    let qtyUnresolved = 0;
    const needsReview = [];

    for (const qty of allQuantities) {
      // Check if price_list_item_id is still valid
      let itemValid = false;
      try {
        const item = await base44.asServiceRole.entities.PriceListItem.get(qty.price_list_item_id);
        if (item) {
          itemValid = true;
        }
      } catch (err) {
        // Item doesn't exist
      }

      if (!itemValid && qty.sku) {
        // Try to resolve via SKU
        const resolvedItem = skuMap.get(qty.sku.toLowerCase());
        if (resolvedItem) {
          if (!dryRun) {
            await base44.asServiceRole.entities.InventoryQuantity.update(qty.id, {
              price_list_item_id: resolvedItem.id
            });
          }
          qtyResolved++;
        } else {
          qtyUnresolved++;
          needsReview.push({
            entity: 'InventoryQuantity',
            id: qty.id,
            sku: qty.sku,
            reason: 'unresolved_sku'
          });
        }
      } else if (!itemValid) {
        qtyUnresolved++;
        needsReview.push({
          entity: 'InventoryQuantity',
          id: qty.id,
          sku: qty.sku || null,
          reason: 'no_sku_to_resolve'
        });
      }
    }

    // ========================================
    // Step 3: Fix broken StockMovement records
    // ========================================
    const allMovements = await base44.asServiceRole.entities.StockMovement.list();
    let movementResolved = 0;
    let movementUnresolved = 0;

    for (const movement of allMovements) {
      let itemResolutionNeeded = false;
      let itemId = movement.price_list_item_id;
      let locationResolutionNeeded = {
        from: !movement.from_location_id,
        to: !movement.to_location_id
      };

      // Check if item exists
      try {
        const item = await base44.asServiceRole.entities.PriceListItem.get(movement.price_list_item_id);
        if (!item) {
          itemResolutionNeeded = true;
        }
      } catch (err) {
        itemResolutionNeeded = true;
      }

      // Check if locations exist
      if (movement.from_location_id) {
        try {
          const loc = await base44.asServiceRole.entities.InventoryLocation.get(movement.from_location_id);
          if (loc) {
            locationResolutionNeeded.from = false;
          }
        } catch (err) {
          locationResolutionNeeded.from = true;
        }
      }

      if (movement.to_location_id) {
        try {
          const loc = await base44.asServiceRole.entities.InventoryLocation.get(movement.to_location_id);
          if (loc) {
            locationResolutionNeeded.to = false;
          }
        } catch (err) {
          locationResolutionNeeded.to = true;
        }
      }

      // Only attempt fixes if there's an issue
      if (!itemResolutionNeeded && !locationResolutionNeeded.from && !locationResolutionNeeded.to) {
        continue;
      }

      // Try to resolve item via SKU
      if (itemResolutionNeeded && movement.sku) {
        const resolvedItem = skuMap.get(movement.sku.toLowerCase());
        if (resolvedItem) {
          itemId = resolvedItem.id;
          itemResolutionNeeded = false;
        }
      }

      // Try to resolve locations via stable keys (vehicle_id, warehouse_id)
      let fromLocId = movement.from_location_id;
      let toLocId = movement.to_location_id;

      if (locationResolutionNeeded.from && movement.from_vehicle_id) {
        const vehicleLoc = locationByVehicleId.get(movement.from_vehicle_id);
        if (vehicleLoc) {
          fromLocId = vehicleLoc.id;
          locationResolutionNeeded.from = false;
        }
      }

      if (locationResolutionNeeded.from && movement.from_warehouse_id) {
        const warehouseLoc = locationByWarehouseId.get(movement.from_warehouse_id);
        if (warehouseLoc) {
          fromLocId = warehouseLoc.id;
          locationResolutionNeeded.from = false;
        }
      }

      if (locationResolutionNeeded.to && movement.to_vehicle_id) {
        const vehicleLoc = locationByVehicleId.get(movement.to_vehicle_id);
        if (vehicleLoc) {
          toLocId = vehicleLoc.id;
          locationResolutionNeeded.to = false;
        }
      }

      if (locationResolutionNeeded.to && movement.to_warehouse_id) {
        const warehouseLoc = locationByWarehouseId.get(movement.to_warehouse_id);
        if (warehouseLoc) {
          toLocId = warehouseLoc.id;
          locationResolutionNeeded.to = false;
        }
      }

      // If all resolvable, apply patch
      if (!itemResolutionNeeded && !locationResolutionNeeded.from && !locationResolutionNeeded.to) {
        if (!dryRun) {
          const patch = {};
          if (itemId !== movement.price_list_item_id) {
            patch.price_list_item_id = itemId;
          }
          if (fromLocId !== movement.from_location_id) {
            patch.from_location_id = fromLocId;
          }
          if (toLocId !== movement.to_location_id) {
            patch.to_location_id = toLocId;
          }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.StockMovement.update(movement.id, patch);
          }
        }
        movementResolved++;
      } else {
        movementUnresolved++;
        const reasons = [];
        if (itemResolutionNeeded) reasons.push('unresolved_item');
        if (locationResolutionNeeded.from) reasons.push('unresolved_from_location');
        if (locationResolutionNeeded.to) reasons.push('unresolved_to_location');

        needsReview.push({
          entity: 'StockMovement',
          id: movement.id,
          sku: movement.sku || null,
          reasons: reasons
        });
      }
    }

    // ========================================
    // Step 4: Create missing InventoryQuantity rows
    // ========================================
    let createdQuantities = 0;

    if (mainWarehouse) {
      for (const item of allPriceListItems) {
        // Check if this item has any InventoryQuantity records
        const existingQties = allQuantities.filter(q => q.price_list_item_id === item.id);
        if (existingQties.length === 0) {
          if (!dryRun) {
            await base44.asServiceRole.entities.InventoryQuantity.create({
              price_list_item_id: item.id,
              location_id: mainWarehouse.id,
              quantity: 0,
              item_name: item.item,
              location_name: mainWarehouse.name
            });
            createdQuantities++;
          } else {
            // In dry-run, only count what would be created
            createdQuantities++;
          }
        }
      }
    }

    // ========================================
    // Return summary
    // ========================================
    const summary = {
      success: true,
      dryRun: dryRun,
      applied: !dryRun,
      inventory_quantities: {
        resolved: qtyResolved,
        unresolved: qtyUnresolved
      },
      stock_movements: {
        resolved: movementResolved,
        unresolved: movementUnresolved
      },
      created_quantities: createdQuantities,
      needs_review: needsReview,
      summary: {
        total_issues_found: qtyUnresolved + movementUnresolved,
        total_issues_fixed: qtyResolved + movementResolved,
        records_created: createdQuantities
      }
    };

    console.log(`[inventoryReferenceMigration] Complete:`, summary);

    return Response.json(summary);

  } catch (error) {
    console.error('[inventoryReferenceMigration] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});