import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time migration: Backfill po_reference for existing Purchase Orders
 * 
 * This ensures all POs have a canonical po_reference field populated from legacy fields:
 * - po_number
 * - order_reference
 * - reference
 * 
 * Priority order: po_number > order_reference > reference
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    console.log('Starting PO reference backfill migration...');

    // Fetch ALL purchase orders
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({});

    console.log(`Found ${allPOs.length} purchase orders to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const po of allPOs) {
      try {
        // Skip if po_reference already exists
        if (po.po_reference) {
          skippedCount++;
          continue;
        }

        // Determine canonical reference from legacy fields
        const canonicalRef =
          po.po_number ||
          po.order_reference ||
          po.reference ||
          null;

        if (!canonicalRef) {
          // No reference to backfill
          skippedCount++;
          console.log(`⚠️ PO ${po.id} has no legacy reference fields to backfill`);
          continue;
        }

        // Update with canonical reference AND backfill legacy fields for consistency
        await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
          po_reference: canonicalRef,
          po_number: canonicalRef,
          order_reference: canonicalRef,
          reference: canonicalRef
        });

        updatedCount++;
        console.log(`✅ Updated PO ${po.id} with po_reference: "${canonicalRef}"`);

      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing PO ${po.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    const summary = {
      success: true,
      total_pos: allPOs.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      error_details: errors
    };

    console.log('Migration complete:', summary);

    return Response.json(summary);

  } catch (error) {
    console.error('Migration failed:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});