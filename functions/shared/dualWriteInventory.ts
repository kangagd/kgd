/**
 * Dual-Write Helper for Inventory Migration
 * Ensures VehicleStock and InventoryQuantity stay in sync during transition
 * 
 * MIGRATION PHASE 2: This module will be removed after migration is complete
 */

/**
 * Updates both VehicleStock and InventoryQuantity for a vehicle
 * @param {object} base44 - SDK instance with service role
 * @param {string} vehicleId - Vehicle entity ID
 * @param {string} productId - PriceListItem entity ID
 * @param {number} newQuantity - New quantity to set
 * @param {string} productName - Cached product name
 * @returns {Promise<void>}
 */
export async function syncVehicleStockQuantity(base44, vehicleId, productId, newQuantity, productName) {
  try {
    // Update VehicleStock
    const vehicleStocks = await base44.asServiceRole.entities.VehicleStock.filter({ 
      vehicle_id: vehicleId, 
      product_id: productId 
    });
    
    if (vehicleStocks.length > 0) {
      await base44.asServiceRole.entities.VehicleStock.update(vehicleStocks[0].id, {
        quantity_on_hand: newQuantity
      });
    }

    // Update InventoryQuantity
    const locations = await base44.asServiceRole.entities.InventoryLocation.filter({ 
      vehicle_id: vehicleId, 
      type: 'vehicle' 
    });
    
    if (locations.length > 0) {
      const location = locations[0];
      const quantities = await base44.asServiceRole.entities.InventoryQuantity.filter({
        location_id: location.id,
        price_list_item_id: productId
      });
      
      if (quantities.length > 0) {
        await base44.asServiceRole.entities.InventoryQuantity.update(quantities[0].id, {
          quantity: newQuantity
        });
      } else {
        // Create if doesn't exist
        await base44.asServiceRole.entities.InventoryQuantity.create({
          location_id: location.id,
          location_name: location.name,
          price_list_item_id: productId,
          item_name: productName,
          quantity: newQuantity,
          minimum_quantity: 0
        });
      }
    }
  } catch (err) {
    console.error('Dual-write sync error:', err);
    // Don't throw - log and continue to prevent breaking existing functionality
  }
}

/**
 * Records movement in both VehicleStockMovement and StockMovement
 * @param {object} base44 - SDK instance
 * @param {object} movementData - Movement details
 * @returns {Promise<void>}
 */
export async function syncMovementRecord(base44, movementData) {
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
    fromLocationId = null,
    toLocationId = null,
    itemName = null
  } = movementData;

  try {
    // Create VehicleStockMovement (old system)
    const vehicleMovementTypes = {
      'job_usage': 'ConsumeOnJob',
      'stock_in': 'RestockFromWarehouse',
      'adjustment': 'Adjustment',
      'transfer': 'TransferToVehicle'
    };

    await base44.asServiceRole.entities.VehicleStockMovement.create({
      vehicle_id: vehicleId,
      product_id: productId,
      job_id: jobId || null,
      project_id: projectId || null,
      movement_type: vehicleMovementTypes[movementType] || 'Adjustment',
      quantity_change: quantityChange,
      reason: reason || '',
      performed_by_user_id: userId,
      performed_by_user_name: userName
    });

    // Create StockMovement (new system)
    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: productId,
      item_name: itemName,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      quantity: Math.abs(quantityChange),
      movement_type: movementType,
      job_id: jobId || null,
      notes: reason || '',
      moved_by: userName,
      moved_by_name: userName
    });
  } catch (err) {
    console.error('Dual-write movement sync error:', err);
    // Don't throw - log and continue
  }
}