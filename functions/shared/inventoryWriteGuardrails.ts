/**
 * Validates that price_list_item_id and location_id exist and are valid.
 * Called before any InventoryQuantity or StockMovement write.
 * Throws error with clear message if validation fails.
 */
export async function validateInventoryReferences(base44, { price_list_item_id, location_id }) {
  if (!price_list_item_id || !location_id) {
    throw new Error('Invalid inventory write: price_list_item_id and location_id are required');
  }

  try {
    // Verify price list item exists
    const priceItem = await base44.entities.PriceListItem.get(price_list_item_id);
    if (!priceItem) {
      throw new Error(`PriceListItem not found: ${price_list_item_id}`);
    }

    // Verify location exists
    const location = await base44.entities.InventoryLocation.get(location_id);
    if (!location) {
      throw new Error(`InventoryLocation not found: ${location_id}`);
    }

    return { priceItem, location };
  } catch (error) {
    if (error.message.includes('not found')) {
      throw error; // Re-throw validation errors
    }
    throw new Error(`Failed to validate inventory references: ${error.message}`);
  }
}