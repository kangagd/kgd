import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { transferStock } from './shared/dualWriteInventory.js';

/**
 * Transfer stock between inventory locations (warehouse ↔ vehicle)
 * Admin-only operation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { from_location_id, to_location_id, price_list_item_id, quantity, reason } = await req.json();

    if (!from_location_id || !to_location_id || !price_list_item_id || !quantity) {
      return Response.json({
        error: 'from_location_id, to_location_id, price_list_item_id, quantity required'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return Response.json({
        error: 'Quantity must be positive'
      }, { status: 400 });
    }

    const result = await transferStock(
      base44,
      from_location_id,
      to_location_id,
      price_list_item_id,
      quantity,
      user.id,
      user.display_name || user.full_name,
      reason || 'Stock transfer'
    );

    return Response.json(result);
  } catch (error) {
    console.error('[transferInventoryLocation] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});