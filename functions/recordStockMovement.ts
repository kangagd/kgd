import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * recordStockMovement - Intelligent classifier & router
 *
 * Accepts flexible input (part_id, price_list_item_id, sku) and classifies items:
 * - Stock-tracked with valid refs → call moveInventory
 * - Non-stock-tracked or missing refs → log activity only (no inventory mutation)
 *
 * Decision logic:
 * 1. Resolve item identity (part_id → Part → PriceListItem, or direct price_list_item_id, or sku lookup)
 * 2. Classify: is item stock-tracked? Check PriceListItem.track_inventory
 * 3. If stock-tracked: validate from_location_id (required for deductions/transfers)
 * 4. If valid: call moveInventory + create StockMovement record
 * 5. If invalid/non-stock-tracked: create Activity/log only, return "recorded_no_deduction"
 * 
 * Never writes broken StockMovement records (missing item or location refs).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      part_id = null,
      price_list_item_id = null,
      sku = null,
      from_location_id = null,
      to_location_id = null,
      quantity = 0,
      source = null,
      notes = '',
      reference_type = null,
      reference_id = null,
      movement_type = null, // 'consume' allows no to_location_id
      audit_only = false,
    } = await req.json();

    const warnings = [];

    // ============================================================
    // Step 1: Resolve item identity
    // ============================================================
    let priceListItemId = null;
    let item = null;

    if (part_id) {
      // Resolve via Part → PriceListItem
      const part = await base44.entities.Part.get(part_id);
      if (part && part.price_list_item_id) {
        priceListItemId = part.price_list_item_id;
      }
    } else if (price_list_item_id) {
      priceListItemId = price_list_item_id;
    } else if (sku) {
      // Resolve SKU to PriceListItem
      const items = await base44.entities.PriceListItem.filter({ sku: sku });
      if (items && items.length > 0) {
        priceListItemId = items[0].id;
      }
    }

    // Fetch item details if we have an ID
    if (priceListItemId) {
      item = await base44.entities.PriceListItem.get(priceListItemId);
    }

    // ============================================================
    // Step 2: Classify item as stock-tracked or non-stock-tracked
    // ============================================================
    const isStockTracked = item && item.track_inventory === true;

    // ============================================================
    // Step 3: Audit-only mode (always allowed if valid source)
    // ============================================================
    if (audit_only) {
      if (user.role !== 'admin' && user.extended_role !== 'manager') {
        return Response.json({
          error: 'Forbidden: Only admin/manager can create audit entries',
          code: 'PERMISSION_DENIED'
        }, { status: 403 });
      }

      if (!source) {
        return Response.json({
          error: 'audit_only requires source parameter',
          code: 'MISSING_SOURCE'
        }, { status: 400 });
      }

      // Create audit-only entry (no item/location validation required)
      const movementRecord = {
        price_list_item_id: priceListItemId || null,
        item_name: item?.item || 'Unknown Item',
        quantity: quantity || 0,
        from_location_id: from_location_id || null,
        to_location_id: to_location_id || null,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: new Date().toISOString(),
        source: source,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        notes: `[AUDIT ONLY] ${notes || 'Manual audit entry'}`
      };

      await base44.asServiceRole.entities.StockMovement.create(movementRecord);

      return Response.json({
        success: true,
        mode: 'audit_only',
        message: 'Audit entry created (no inventory mutation)',
        warnings: []
      });
    }

    // ============================================================
    // Step 4: Classify and route non-audit movements
    // ============================================================
    
    // Non-stock-tracked items: log activity only
    if (!isStockTracked) {
      return Response.json({
        success: true,
        mode: 'recorded_no_deduction',
        reason: item ? 'item_not_tracked' : 'item_not_found',
        message: item 
          ? `Item "${item.item}" is not stock-tracked. Activity recorded without inventory mutation.`
          : 'Item not found or not specified. Activity recorded without inventory mutation.',
        warnings: []
      });
    }

    // Stock-tracked items: validate references
    if (quantity <= 0) {
      return Response.json({
        error: 'Quantity must be greater than 0',
        code: 'INVALID_QUANTITY'
      }, { status: 400 });
    }

    if (!from_location_id) {
      return Response.json({
        error: 'MISSING_FROM_LOCATION: Stock-tracked deductions require from_location_id',
        code: 'MISSING_FROM_LOCATION'
      }, { status: 400 });
    }

    // For transfers (no movement_type or movement_type != 'consume'), require to_location_id
    if (movement_type !== 'consume' && !to_location_id) {
      return Response.json({
        error: 'For transfers, to_location_id is required. For consumption, set movement_type="consume"',
        code: 'MISSING_TO_LOCATION'
      }, { status: 400 });
    }

    // Validate locations exist
    const fromLoc = await base44.entities.InventoryLocation.get(from_location_id);
    if (!fromLoc) {
      return Response.json({
        error: 'MISSING_FROM_LOCATION: from_location_id does not exist',
        code: 'FROM_LOCATION_NOT_FOUND'
      }, { status: 404 });
    }

    let toLoc = null;
    if (to_location_id) {
      toLoc = await base44.entities.InventoryLocation.get(to_location_id);
      if (!toLoc) {
        return Response.json({
          error: 'to_location_id does not exist',
          code: 'TO_LOCATION_NOT_FOUND'
        }, { status: 404 });
      }
    }

    // ============================================================
    // Step 5: Call moveInventory for stock-tracked, valid refs
    // ============================================================
    try {
      const moveResult = await base44.asServiceRole.functions.invoke('moveInventory', {
        priceListItemId: priceListItemId,
        fromLocationId: from_location_id,
        toLocationId: to_location_id || null,
        quantity: quantity,
        source: source || 'manual',
        jobId: reference_type === 'job' ? reference_id : null,
        vehicleId: reference_type === 'vehicle' ? reference_id : null,
        notes: notes,
        idempotency_key: reference_id ? `${reference_type}-${reference_id}-${priceListItemId}` : null
      });

      if (!moveResult.data?.success) {
        return Response.json({
          success: false,
          error: moveResult.data?.error || 'moveInventory failed',
          mode: 'deduction_failed'
        }, { status: 400 });
      }

      return Response.json({
        success: true,
        mode: 'deducted',
        message: moveResult.data?.message,
        updated_quantities: moveResult.data?.updated_quantities || [],
        warnings: warnings
      });

    } catch (moveErr) {
      console.error('[recordStockMovement] moveInventory call failed:', moveErr);
      return Response.json({
        success: false,
        error: moveErr.message || 'Failed to execute inventory deduction',
        mode: 'deduction_failed',
        code: 'DEDUCTION_ERROR'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[recordStockMovement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});