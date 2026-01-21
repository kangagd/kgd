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
    
    // Index PO lines by part_id
    const poLineByPartId = new Map();
    for (const line of poLines) {
      if (line.part_id) {
        poLineByPartId.set(line.part_id, line);
      }
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const part of parts) {
      const poLine = poLineByPartId.get(part.id);
      
      if (!poLine) {
        skipped++;
        continue;
      }

      // Only update if item_name differs
      if (poLine.item_name && poLine.item_name !== part.item_name) {
        try {
          await base44.asServiceRole.entities.Part.update(part.id, {
            item_name: poLine.item_name
          });
          updated++;
          console.log(`Updated Part ${part.id}: "${part.item_name}" → "${poLine.item_name}"`);
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