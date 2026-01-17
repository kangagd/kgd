import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * NEW SCHEMA: Record stock movement via inventory location ledger
 * CANONICAL PATH for all manual stock adjustments
 * 
 * Writes to:
 * - InventoryQuantity (on-hand source of truth)
 * - StockMovement (audit ledger)
 * 
 * Does NOT write to:
 * - PriceListItem.stock_level (deprecated, cached only)
 * - VehicleStock (computed only)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      priceListItemId,
      fromLocationId,
      toLocationId,
      quantity,
      movementType = 'manual_adjustment',
      notes = null,
      jobId = null,
    } = await req.json();

    // Validate required fields
    if (!priceListItemId || !quantity || quantity <= 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (!fromLocationId && !toLocationId) {
      return Response.json({ error: 'At least one location required' }, { status: 400 });
    }

    // Get item details
    const item = await base44.entities.PriceListItem.get(priceListItemId);
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    let fromLocation = null;
    let toLocation = null;

    // Validate from location has sufficient stock
    if (fromLocationId) {
      fromLocation = await base44.entities.InventoryLocation.get(fromLocationId);
      if (!fromLocation) {
        return Response.json({ error: 'Source location not found' }, { status: 404 });
      }

      const sourceQty = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: fromLocationId
      });

      const currentQty = sourceQty[0]?.quantity || 0;
      if (currentQty < quantity) {
        return Response.json({ 
          error: `Insufficient stock. Available: ${currentQty}, Requested: ${quantity}` 
        }, { status: 400 });
      }

      // Decrement from source
      if (sourceQty[0]) {
        await base44.asServiceRole.entities.InventoryQuantity.update(sourceQty[0].id, {
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

      const destQty = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: toLocationId
      });

      if (destQty[0]) {
        await base44.asServiceRole.entities.InventoryQuantity.update(destQty[0].id, {
          quantity: (destQty[0].quantity || 0) + quantity
        });
      } else {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id: priceListItemId,
          location_id: toLocationId,
          quantity: quantity,
          item_name: item.item,
          location_name: toLocation.name
        });
      }
    }

    // Create audit ledger entry (StockMovement)
    await base44.asServiceRole.entities.StockMovement.create({
      sku_id: priceListItemId,
      item_name: item.item,
      quantity: quantity,
      from_location_id: fromLocationId,
      from_location_name: fromLocation?.name || null,
      to_location_id: toLocationId,
      to_location_name: toLocation?.name || null,
      performed_by_user_id: user.id,
      performed_by_user_email: user.email,
      performed_by_user_name: user.full_name || user.display_name,
      performed_at: new Date().toISOString(),
      source: movementType,
      notes: notes || null,
      job_id: jobId
    });

    return Response.json({
      success: true,
      message: `Moved ${quantity} ${item.item} ${fromLocation ? `from ${fromLocation.name}` : ''} ${toLocation ? `to ${toLocation.name}` : ''}`,
      item_name: item.item,
      quantity_moved: quantity
    });

  } catch (error) {
    console.error('[recordStockMovement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});