import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEPRECATED: recordStockMovement is AUDIT-ONLY
 *
 * ⚠️  BREAKING CHANGE: This function NO LONGER mutates InventoryQuantity ⚠️
 *
 * The canonical inventory writers are:
 * - receivePoItems        (PO receipts) → for procuring stock
 * - moveInventory         (transfers + job deductions) → for stock allocation
 * - adjustStockCorrection (admin corrections) → for inventory count fixes
 * - seedBaselineStock     (day-0 initialization) → for baseline seeding
 *
 * This function now ONLY creates StockMovement audit records if auditOnly=true.
 * All direct mutations have been replaced with calls to canonical functions above.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      auditOnly = false,
      priceListItemId,
      fromLocationId,
      toLocationId,
      quantity,
      source,
      notes,
      reference_type,
      reference_id,
    } = await req.json();

    // Audit-only mode: allows admins/managers to log movements without mutating
    if (auditOnly) {
      if (user.role !== 'admin' && user.extended_role !== 'manager') {
        return Response.json({ 
          error: 'Forbidden: Only admin/manager can audit' 
        }, { status: 403 });
      }

      // Minimal validation for audit entries
      if (!priceListItemId || !source) {
        return Response.json({ error: 'auditOnly requires priceListItemId and source' }, { status: 400 });
      }

      const item = await base44.entities.PriceListItem.get(priceListItemId);
      if (!item) {
        return Response.json({ error: 'Item not found' }, { status: 404 });
      }

      // Create audit-only entry (no mutation)
      await base44.asServiceRole.entities.StockMovement.create({
        price_list_item_id: priceListItemId,
        item_name: item.item,
        quantity: quantity || 0,
        from_location_id: fromLocationId || null,
        to_location_id: toLocationId || null,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: new Date().toISOString(),
        source: source,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        notes: `[AUDIT ONLY] ${notes || 'Manual audit entry'}`
      });

      return Response.json({
        success: true,
        message: 'Audit entry created (no inventory mutation)',
        audit_only: true
      });
    }

    // Non-audit mode: FORBIDDEN - use canonical writers instead
    return Response.json(
      {
        error: 'recordStockMovement is deprecated for mutations. Use canonical writers:',
        canonical_functions: {
          'transfers': 'moveInventory',
          'po_receipt': 'receivePoItems',
          'job_usage': 'moveInventory',
          'admin_corrections': 'adjustStockCorrection',
          'baseline_init': 'seedBaselineStock'
        },
        audit_mode: 'Pass auditOnly=true + admin/manager role to create audit-only entries'
      },
      { status: 410 } // Gone: this endpoint no longer mutates
    );

  } catch (error) {
    console.error('[recordStockMovement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});