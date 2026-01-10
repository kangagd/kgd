/**
 * Dual-write inventory helpers
 * Keeps VehicleStock and InventoryQuantity in sync
 */

/**
 * Sync a stock quantity to both VehicleStock and InventoryQuantity systems
 */
export async function syncVehicleStockQuantity(base44, vehicleId, productId, newQuantity, itemName) {
  try {
    // Update VehicleStock
    const vehicleStockList = await base44.entities.VehicleStock.filter({
      vehicle_id: vehicleId,
      product_id: productId
    });

    if (vehicleStockList.length > 0) {
      await base44.entities.VehicleStock.update(vehicleStockList[0].id, {
        quantity_on_hand: newQuantity
      });
    }

    // Update InventoryQuantity for the vehicle location
    const locations = await base44.asServiceRole.entities.InventoryLocation.filter({
      vehicle_id: vehicleId,
      type: 'vehicle'
    });

    if (locations.length > 0) {
      const locationId = locations[0].id;
      const quantityList = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id: productId,
        location_id: locationId
      });

      if (quantityList.length > 0) {
        await base44.asServiceRole.entities.InventoryQuantity.update(quantityList[0].id, {
          quantity: newQuantity
        });
      } else {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id: productId,
          location_id: locationId,
          quantity: newQuantity,
          item_name: itemName,
          location_name: locations[0].name
        });
      }
    }
  } catch (err) {
    console.error('[syncVehicleStockQuantity] Error:', err);
    throw err;
  }
}

/**
 * Record a stock movement in StockMovement table
 */
export async function syncMovementRecord(base44, movement) {
  try {
    const {
      vehicleId,
      productId,
      jobId,
      projectId,
      movementType,
      quantityChange,
      reason,
      userId,
      userName,
      fromLocationId,
      toLocationId,
      itemName
    } = movement;

    // Determine from/to location names
    let fromLocationName = null;
    let toLocationName = null;

    if (fromLocationId) {
      const loc = await base44.asServiceRole.entities.InventoryLocation.get(fromLocationId);
      fromLocationName = loc?.name;
    }

    if (toLocationId) {
      const loc = await base44.asServiceRole.entities.InventoryLocation.get(toLocationId);
      toLocationName = loc?.name;
    }

    // Create StockMovement record
    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: productId,
      item_name: itemName,
      from_location_id: fromLocationId,
      from_location_name: fromLocationName,
      to_location_id: toLocationId,
      to_location_name: toLocationName,
      quantity: Math.abs(quantityChange),
      movement_type: movementType,
      job_id: jobId,
      notes: reason,
      moved_by: userId,
      moved_by_name: userName
    });
  } catch (err) {
    console.error('[syncMovementRecord] Error:', err);
    throw err;
  }
}

/**
 * Transfer stock between two locations (warehouse to vehicle, or vehicle to warehouse)
 */
export async function transferStock(base44, fromLocationId, toLocationId, productId, quantity, userId, userName, reason) {
  try {
    // Get both locations
    const fromLocation = await base44.asServiceRole.entities.InventoryLocation.get(fromLocationId);
    const toLocation = await base44.asServiceRole.entities.InventoryLocation.get(toLocationId);

    // Get current quantities
    const fromQtyList = await base44.asServiceRole.entities.InventoryQuantity.filter({
      location_id: fromLocationId,
      price_list_item_id: productId
    });

    const toQtyList = await base44.asServiceRole.entities.InventoryQuantity.filter({
      location_id: toLocationId,
      price_list_item_id: productId
    });

    if (fromQtyList.length === 0) {
      throw new Error('Item not found in source location');
    }

    const fromQuantity = fromQtyList[0];
    if ((fromQuantity.quantity || 0) < quantity) {
      throw new Error('Insufficient quantity in source location');
    }

    // Update source location (decrement)
    const newFromQty = (fromQuantity.quantity || 0) - quantity;
    await base44.asServiceRole.entities.InventoryQuantity.update(fromQuantity.id, {
      quantity: newFromQty
    });

    // Update destination location (increment)
    let newToQty;
    if (toQtyList.length > 0) {
      newToQty = (toQtyList[0].quantity || 0) + quantity;
      await base44.asServiceRole.entities.InventoryQuantity.update(toQtyList[0].id, {
        quantity: newToQty
      });
    } else {
      newToQty = quantity;
      const item = await base44.asServiceRole.entities.PriceListItem.get(productId);
      await base44.asServiceRole.entities.InventoryQuantity.create({
        price_list_item_id: productId,
        location_id: toLocationId,
        quantity: newToQty,
        item_name: item?.item,
        location_name: toLocation.name
      });
    }

    // Record movement
    const item = await base44.asServiceRole.entities.PriceListItem.get(productId);
    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: productId,
      item_name: item?.item,
      from_location_id: fromLocationId,
      from_location_name: fromLocation.name,
      to_location_id: toLocationId,
      to_location_name: toLocation.name,
      quantity: quantity,
      movement_type: 'transfer',
      notes: reason || 'Stock transfer',
      moved_by: userId,
      moved_by_name: userName
    });

    return {
      success: true,
      fromLocationId,
      toLocationId,
      productId,
      quantity,
      fromNewQuantity: newFromQty,
      toNewQuantity: newToQty
    };
  } catch (err) {
    console.error('[transferStock] Error:', err);
    throw err;
  }
}