import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time migration: Sync all Parts linked to Draft POs to have "pending" status
 * Run this once to fix existing data inconsistencies
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }

    console.log('Starting Draft PO → Part status sync...');

    // Fetch all draft purchase orders
    const draftPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({
      status: 'draft'
    });

    console.log(`Found ${draftPOs.length} draft POs`);

    let updatedPartsCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const po of draftPOs) {
      try {
        // Find all parts linked to this PO
        const linkedParts = await base44.asServiceRole.entities.Part.filter({
          purchase_order_id: po.id
        });

        for (const part of linkedParts) {
          // Only update if not already pending
          if (part.status !== 'pending') {
            await base44.asServiceRole.entities.Part.update(part.id, {
              status: 'pending',
              order_date: null,
              eta: null
            });
            updatedPartsCount++;
            console.log(`✅ Updated part ${part.id} (was: ${part.status}) for PO ${po.id}`);
          } else {
            skippedCount++;
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing PO ${po.id}:`, error.message);
      }
    }

    const summary = {
      success: true,
      draft_pos_processed: draftPOs.length,
      parts_updated: updatedPartsCount,
      parts_skipped: skippedCount,
      errors: errorCount
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