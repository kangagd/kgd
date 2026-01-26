import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all Parts that have a po_line_id but missing or empty item_name
    const partsNeedingUpdate = await base44.asServiceRole.entities.Part.filter({
      po_line_id: { $exists: true, $ne: null },
      $or: [
        { item_name: { $exists: false } },
        { item_name: null },
        { item_name: '' }
      ]
    }, '-created_date', 1000);

    console.log(`Found ${partsNeedingUpdate.length} parts with missing names`);

    // Get all PO lines in one batch
    const poLineIds = [...new Set(partsNeedingUpdate.map(p => p.po_line_id).filter(Boolean))];
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      id: { $in: poLineIds }
    }, '-created_date', 1000);

    const poLineMap = Object.fromEntries(poLines.map(pl => [pl.id, pl]));

    const updates = [];
    const skipped = [];

    for (const part of partsNeedingUpdate) {
      const poLine = poLineMap[part.po_line_id];
      
      if (poLine && poLine.item_name) {
        updates.push({
          partId: part.id,
          oldName: part.item_name || '(empty)',
          newName: poLine.item_name,
          qty: poLine.qty_ordered || part.quantity_required
        });

        await base44.asServiceRole.entities.Part.update(part.id, {
          item_name: poLine.item_name,
          quantity_required: poLine.qty_ordered || part.quantity_required
        });
      } else {
        skipped.push({
          partId: part.id,
          reason: poLine ? 'PO line has no item_name' : 'PO line not found'
        });
      }
    }

    return Response.json({
      success: true,
      updated: updates.length,
      skipped: skipped.length,
      updates,
      skipped
    });

  } catch (error) {
    console.error('Error backfilling part names:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});