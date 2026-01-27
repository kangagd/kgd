import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    let { priceListItemId, locationId, quantity, count = 1, skuOrId, locationNameOrId } = body;

    // Lookup by SKU/name if IDs not provided
    if (!priceListItemId && skuOrId) {
      const items = await base44.entities.PriceListItem.filter({ sku: skuOrId });
      if (items.length > 0) {
        priceListItemId = items[0].id;
      }
    }

    if (!locationId && locationNameOrId) {
      const locations = await base44.entities.InventoryLocation.filter({ name: locationNameOrId });
      if (locations.length > 0) {
        locationId = locations[0].id;
      }
    }

    if (!priceListItemId || !locationId) {
      return Response.json({ 
        error: 'Could not find priceListItemId or locationId',
        provided: { skuOrId, locationNameOrId, priceListItemId, locationId }
      }, { status: 400 });
    }

    // Try to find StockMovement records first
    let movements = await base44.entities.StockMovement.filter({
      price_list_item_id: priceListItemId,
      from_location_id: locationId
    });

    // If no movements, update InventoryQuantity directly (for failed operations that already deducted)
    if (movements.length === 0) {
      const quantityRecord = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: locationId
      });

      if (quantityRecord.length === 0) {
        return Response.json({ 
          error: 'No InventoryQuantity record found for this item/location' 
        }, { status: 404 });
      }

      // Add back the quantity
      const qtyRecord = quantityRecord[0];
      const newQuantity = (qtyRecord.quantity || 0) + (quantity * count);
      const updated = await base44.entities.InventoryQuantity.update(qtyRecord.id, {
        quantity: newQuantity
      });

      return Response.json({
        success: true,
        method: 'InventoryQuantity direct update',
        previous_quantity: qtyRecord.quantity,
        added: quantity * count,
        new_quantity: newQuantity,
        record_id: updated.id
      });
    }

    // Sort by created_date descending and take the most recent 'count'
    const toRevert = movements
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, count);

    // Create reverse movements for each
    const reversals = await Promise.all(
      toRevert.map(movement =>
        base44.entities.StockMovement.create({
          price_list_item_id: priceListItemId,
          from_location_id: movement.to_location_id,
          to_location_id: movement.from_location_id,
          quantity: -movement.quantity,
          movement_type: 'reversal',
          reference_type: 'reversal',
          reference_id: movement.id,
          notes: `Reversal of erroneous movement: ${movement.notes || 'Mark as Used'}`
        })
      )
    );

    return Response.json({
      success: true,
      method: 'StockMovement reversals',
      reverted_count: reversals.length,
      reversals: reversals.map(r => ({ id: r.id, quantity: r.quantity }))
    });
  } catch (error) {
    console.error('Error reverting movements:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});