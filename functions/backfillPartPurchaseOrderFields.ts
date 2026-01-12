/**
 * backfillPartPurchaseOrderFields - Migrate parts to new multi-PO schema
 * Sets purchase_order_ids array and primary_purchase_order_id from legacy purchase_order_id
 * Run ONCE before deploying new code
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[backfillPartPurchaseOrderFields] Starting migration for all parts');

    // Get ALL parts (no pagination for atomic backfill)
    const allParts = await base44.asServiceRole.entities.Part.list(null, 5000);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const part of allParts) {
      try {
        // Skip if already migrated
        if (part.primary_purchase_order_id) {
          skipped++;
          continue;
        }

        const updateData = {
          last_synced_from_po_at: new Date().toISOString(),
          synced_by: 'system:backfillPartPurchaseOrderFields'
        };

        // Set primary_purchase_order_id from legacy purchase_order_id
        if (part.purchase_order_id) {
          updateData.primary_purchase_order_id = part.purchase_order_id;
          updateData.purchase_order_ids = [part.purchase_order_id];
        } else {
          // No PO at all - leave both empty
          updateData.purchase_order_ids = [];
        }

        await base44.asServiceRole.entities.Part.update(part.id, updateData);
        updated++;

        if (updated % 50 === 0) {
          console.log(`[backfillPartPurchaseOrderFields] Progress: ${updated} updated, ${skipped} skipped`);
        }
      } catch (error) {
        console.error(`[backfillPartPurchaseOrderFields] Error updating part ${part.id}:`, error);
        errors++;
      }
    }

    console.log('[backfillPartPurchaseOrderFields] Migration complete', {
      total_parts: allParts.length,
      updated,
      skipped,
      errors
    });

    return Response.json({
      success: true,
      summary: {
        total_parts: allParts.length,
        updated,
        skipped,
        errors
      }
    });
  } catch (error) {
    console.error('[backfillPartPurchaseOrderFields] Fatal error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});