import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      priceListItemId, 
      fromLocationId, 
      toLocationId, 
      quantity, 
      movementType = 'transfer',
      jobId = null,
      notes = null 
    } = body;

    if (!priceListItemId || !quantity || quantity <= 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Validate movement type
    if (movementType === 'transfer' && (!fromLocationId || !toLocationId)) {
      return Response.json({ error: 'Transfer requires both from and to locations' }, { status: 400 });
    }

    // Get item details
    const item = await base44.entities.PriceListItem.get(priceListItemId);
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    let fromLocation = null;
    let toLocation = null;

    // For transfers, validate source has enough stock
    if (fromLocationId) {
      fromLocation = await base44.entities.InventoryLocation.get(fromLocationId);
      if (!fromLocation) {
        return Response.json({ error: 'Source location not found' }, { status: 404 });
      }

      const sourceQuantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: fromLocationId
      });

      const currentQty = sourceQuantities[0]?.quantity || 0;
      if (currentQty < quantity) {
        return Response.json({ 
          error: `Insufficient stock at ${fromLocation.name}. Available: ${currentQty}, Requested: ${quantity}` 
        }, { status: 400 });
      }

      // Deduct from source
      if (sourceQuantities[0]) {
        await base44.entities.InventoryQuantity.update(sourceQuantities[0].id, {
          quantity: currentQty - quantity
        });
      }
    }

    // Add to destination
    if (toLocationId) {
      toLocation = await base44.entities.InventoryLocation.get(toLocationId);
      if (!toLocation) {
        return Response.json({ error: 'Destination location not found' }, { status: 404 });
      }

      const destQuantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: toLocationId
      });

      if (destQuantities[0]) {
        // Update existing quantity
        await base44.entities.InventoryQuantity.update(destQuantities[0].id, {
          quantity: (destQuantities[0].quantity || 0) + quantity
        });
      } else {
        // Create new quantity record
        await base44.entities.InventoryQuantity.create({
          price_list_item_id: priceListItemId,
          location_id: toLocationId,
          quantity: quantity,
          item_name: item.item,
          location_name: toLocation.name
        });
      }
    }

    // Log the movement
    await base44.entities.StockMovement.create({
      price_list_item_id: priceListItemId,
      item_name: item.item,
      from_location_id: fromLocationId || null,
      from_location_name: fromLocation?.name || null,
      to_location_id: toLocationId || null,
      to_location_name: toLocation?.name || null,
      quantity: quantity,
      movement_type: movementType,
      job_id: jobId,
      notes: notes,
      moved_by: user.email,
      moved_by_name: user.full_name
    });

    return Response.json({
      success: true,
      message: `Moved ${quantity} ${item.item} ${fromLocation ? `from ${fromLocation.name}` : ''} ${toLocation ? `to ${toLocation.name}` : ''}`
    });

  } catch (error) {
    console.error('moveInventory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});