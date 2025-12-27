import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time migration script to copy legacy PO reference fields to po_number
 * Run this once to backfill po_number for all existing POs
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all purchase orders
    const purchaseOrders = await base44.asServiceRole.entities.PurchaseOrder.list();
    
    let migrated = 0;
    let skipped = 0;
    const errors = [];

    for (const po of purchaseOrders) {
      // Skip if po_number already set
      if (po.po_number) {
        skipped++;
        continue;
      }

      // Try to migrate from legacy fields
      const ref = po.order_reference || po.reference || null;
      
      if (ref) {
        try {
          await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
            po_number: ref,
            order_reference: ref,
            reference: ref,
          });
          migrated++;
        } catch (error) {
          errors.push({ po_id: po.id, error: error.message });
        }
      } else {
        skipped++;
      }
    }

    return Response.json({
      success: true,
      total: purchaseOrders.length,
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});