import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEPRECATED: recordStockMovement
 *
 * This function MUST NOT mutate InventoryQuantity.
 * Canonical InventoryQuantity writers are:
 * - moveInventory (transfers)
 * - receivePoItems (PO receipts)
 * - adjustStockCorrection (admin corrections)
 * - seedBaselineStock (baseline)
 * - autoDeductJobUsage (job consumption)
 *
 * This endpoint is kept only for:
 * - legacy backfill / audit-only StockMovement entries (explicitly opted-in)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      priceListItemId,
      fromLocationId = null,
      toLocationId = null,
      quantity,
      source = 'manual_adjustment',
      notes = null,
      reference_type = null,
      reference_id = null,
      // IMPORTANT: you must explicitly opt-in to legacy audit-only writes
      auditOnly = false,
    } = await req.json();

    if (!priceListItemId || !quantity || quantity <= 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Hard block normal use: forces all callers onto canonical functions.
    if (!auditOnly) {
      return Response.json(
        {
          error: 'recordStockMovement is deprecated.',
          message:
            'Use canonical functions instead: moveInventory (transfer), receivePoItems (PO receipt), adjustStockCorrection (admin correction), seedBaselineStock (baseline), autoDeductJobUsage (consumption).',
          next_step: {
            transfer: 'Call moveInventory({ priceListItemId, fromLocationId, toLocationId, quantity })',
            adjustment: 'Call adjustStockCorrection({ priceListItemId, locationId, ... })',
          },
        },
        { status: 410 } // Gone
      );
    }

    // Audit-only mode (admin/manager only is safest)
    if (!['admin', 'manager'].includes(user.role)) {
      return Response.json({ error: 'Forbidden (auditOnly requires admin/manager)' }, { status: 403 });
    }

    // Validate source enum (keep aligned with your StockMovement schema)
    const validSources = ['transfer', 'po_receipt', 'logistics_job_completion', 'manual_adjustment', 'job_usage', 'baseline_seed'];
    if (!validSources.includes(source)) {
      return Response.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    // Resolve names for readability (no InventoryQuantity mutations)
    const item = await base44.entities.PriceListItem.get(priceListItemId);
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

    const fromLoc = fromLocationId ? await base44.entities.InventoryLocation.get(fromLocationId) : null;
    const toLoc = toLocationId ? await base44.entities.InventoryLocation.get(toLocationId) : null;

    if (fromLocationId && !fromLoc) return Response.json({ error: 'Source location not found' }, { status: 404 });
    if (toLocationId && !toLoc) return Response.json({ error: 'Destination location not found' }, { status: 404 });

    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: priceListItemId,
      item_name: item.item,
      quantity,
      from_location_id: fromLocationId,
      from_location_name: fromLoc?.name || null,
      to_location_id: toLocationId,
      to_location_name: toLoc?.name || null,
      performed_by_user_email: user.email,
      performed_by_user_name: user.full_name || user.display_name || user.email,
      performed_at: new Date().toISOString(),
      source,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      notes: notes || '[auditOnly] legacy StockMovement record (no InventoryQuantity mutation)',
    });

    return Response.json({
      success: true,
      auditOnly: true,
      message: `Audit-only StockMovement recorded for ${quantity} × ${item.item}. No InventoryQuantity was changed.`,
    });
  } catch (error) {
    console.error('[recordStockMovement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
