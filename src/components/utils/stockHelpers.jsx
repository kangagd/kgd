import { base44 } from "@/api/base44Client";

/**
 * DEPRECATED: Legacy recordStockMovement helper
 * 
 * This is now a SHIM that calls the canonical backend function.
 * DO NOT use the legacy payload shape (quantity_delta, from_location, etc.)
 * 
 * Convert callers to use moveInventory() function directly instead.
 * 
 * @deprecated Use base44.functions.invoke('recordStockMovement', {...}) instead
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

  // This helper is deprecated—throw error to force migration to backend function
  throw new Error(
    "Legacy recordStockMovement helper is deprecated. " +
    "Call base44.functions.invoke('recordStockMovement', {...}) with NEW schema instead. " +
    "See audit report for migration details."
  );
}

/**
 * Calculate current stock level from movements
 * @param {string} stock_item_id - PriceListItem ID
 * @returns {Promise<number>} Calculated stock level
 */
export async function calculateStockFromMovements(stock_item_id) {
  const movements = await base44.entities.StockMovement.filter({
    sku_id: stock_item_id,
  });

  const total = movements.reduce((sum, movement) => {
    // Only count positive quantities from movements (new schema)
    return sum + (movement.quantity || 0);
  }, 0);

  return total;
}