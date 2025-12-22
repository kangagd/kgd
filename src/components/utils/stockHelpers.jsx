import { base44 } from "@/api/base44Client";

/**
 * Record a stock movement and update the item's stock level
 * @param {Object} payload - Movement details
 * @param {string} payload.stock_item_id - PriceListItem ID
 * @param {number} payload.quantity_delta - Change in quantity (+ or -)
 * @param {string} payload.reason - Reason for movement
 * @param {string} [payload.from_location] - Source location
 * @param {string} [payload.to_location] - Destination location
 * @param {string} [payload.vehicle_id] - Vehicle ID if applicable
 * @param {string} [payload.project_id] - Project ID if applicable
 * @param {string} [payload.job_id] - Job ID if applicable
 * @param {string} [payload.notes] - Additional notes
 * @returns {Promise<Object>} Created movement record and new stock level
 */
export async function recordStockMovement(payload) {
  const {
    stock_item_id,
    quantity_delta,
    reason,
    from_location = null,
    to_location = null,
    vehicle_id = null,
    project_id = null,
    job_id = null,
    notes = null,
  } = payload;

  // Validate required fields
  if (!stock_item_id || quantity_delta === undefined || !reason) {
    throw new Error("Missing required fields: stock_item_id, quantity_delta, reason");
  }

  // Get current stock item
  const item = await base44.entities.PriceListItem.get(stock_item_id);
  if (!item) {
    throw new Error("Stock item not found");
  }

  const previousStock = item.stock_level || 0;
  const newStock = previousStock + quantity_delta;

  // Prevent negative stock
  if (newStock < 0) {
    throw new Error(`Insufficient stock. Current: ${previousStock}, Requested: ${Math.abs(quantity_delta)}`);
  }

  // Create movement record
  const movement = await base44.entities.StockMovement.create({
    stock_item_id,
    quantity_delta,
    reason,
    from_location,
    to_location,
    vehicle_id,
    project_id,
    job_id,
    notes,
  });

  // Update stock level
  await base44.entities.PriceListItem.update(stock_item_id, {
    stock_level: newStock,
  });

  return {
    movement,
    previousStock,
    newStock,
  };
}

/**
 * Calculate current stock level from movements
 * @param {string} stock_item_id - PriceListItem ID
 * @returns {Promise<number>} Calculated stock level
 */
export async function calculateStockFromMovements(stock_item_id) {
  const movements = await base44.entities.StockMovement.filter({
    stock_item_id,
  });

  const total = movements.reduce((sum, movement) => {
    return sum + (movement.quantity_delta || 0);
  }, 0);

  return total;
}