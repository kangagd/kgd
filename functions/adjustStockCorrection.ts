import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { priceListItemId, locationId, quantity, isExactCount, reason } = await req.json();

    if (!priceListItemId || !locationId || quantity === undefined || !reason) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch current inventory quantity
    const current = await base44.asServiceRole.entities.InventoryQuantity.filter({
      price_list_item_id: priceListItemId,
      location_id: locationId
    });

    const currentQty = current[0]?.quantity || 0;
    const newQty = isExactCount ? quantity : currentQty + quantity;

    // Ensure non-negative
    if (newQty < 0) {
      return Response.json({ error: 'Stock cannot be negative' }, { status: 400 });
    }

    const delta = newQty - currentQty;

    // Fetch location and item details for audit
    const location = await base44.asServiceRole.entities.InventoryLocation.get(locationId);
    const item = await base44.asServiceRole.entities.PriceListItem.get(priceListItemId);

    // Update InventoryQuantity
    if (current[0]) {
      await base44.asServiceRole.entities.InventoryQuantity.update(current[0].id, {
        quantity: newQty
      });
    } else {
      await base44.asServiceRole.entities.InventoryQuantity.create({
        price_list_item_id: priceListItemId,
        location_id: locationId,
        quantity: newQty,
        item_name: item?.item || 'Unknown Item',
        location_name: location?.name || 'Unknown Location'
      });
    }

    // Create StockMovement audit record (canonical schema)
    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: priceListItemId,
      item_name: item?.item || 'Unknown Item',
      quantity: Math.abs(delta),
      from_location_id: delta < 0 ? locationId : null,
      from_location_name: delta < 0 ? location?.name : null,
      to_location_id: delta > 0 ? locationId : null,
      to_location_name: delta > 0 ? location?.name : null,
      performed_by_user_email: user.email,
      performed_by_user_name: user.full_name || user.display_name || user.email,
      performed_at: new Date().toISOString(),
      source: 'manual_adjustment',
      notes: `Admin correction: ${isExactCount ? `set exact: ${currentQty} → ${newQty}` : `delta: ${delta > 0 ? '+' : ''}${delta}`}. Reason: ${reason}`
    });

    return Response.json({
      success: true,
      message: `Stock adjusted: ${currentQty} → ${newQty} units`,
      delta,
      newQuantity: newQty
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});