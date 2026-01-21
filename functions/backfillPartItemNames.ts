import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * One-time backfill: Syncs item_name from PurchaseOrderLine to Part
 * Ensures all Parts display the correct name from their PO lines
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const parts = await base44.asServiceRole.entities.Part.list(null, 2000);
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.list(null, 2000);
    
    // Index PO lines by id (Part has po_line_id pointing to PurchaseOrderLine.id)
    const poLineById = new Map();
    for (const line of poLines) {
      poLineById.set(line.id, line);
    }

    let updated = 0;
    let skipped = 0;
    let noPoLine = 0;
    const errors = [];

    for (const part of parts) {
      // Part.po_line_id points to PurchaseOrderLine.id
      if (!part.po_line_id) {
        noPoLine++;
        continue;
      }

      const poLine = poLineById.get(part.po_line_id);
      
      if (!poLine) {
        skipped++;
        continue;
      }

      // Only update if item_name exists on PO line and differs from Part
      if (poLine.item_name && poLine.item_name !== part.item_name) {
        try {
          await base44.asServiceRole.entities.Part.update(part.id, {
            item_name: poLine.item_name
          });
          updated++;
          console.log(`Updated Part ${part.id}: "${part.item_name || '(empty)'}" → "${poLine.item_name}"`);
        } catch (err) {
          errors.push(`Part ${part.id}: ${err.message}`);
        }
      } else {
        skipped++;
      }
    }

    return Response.json({
      success: true,
      total_parts: parts.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});