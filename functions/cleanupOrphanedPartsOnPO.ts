import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { purchase_order_id } = await req.json();
    
    if (!purchase_order_id) {
      return Response.json({ error: 'purchase_order_id required' }, { status: 400 });
    }

    const po = await base44.asServiceRole.entities.PurchaseOrder.get(purchase_order_id);
    if (!po) {
      return Response.json({ error: 'PO not found' }, { status: 404 });
    }

    // Get all parts linked to this PO (both primary and legacy)
    const partsByPrimary = await base44.asServiceRole.entities.Part.filter({
      primary_purchase_order_id: po.id
    });
    
    const partsByLegacy = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id: po.id
    });

    const allParts = [...partsByPrimary, ...partsByLegacy];

    // Find orphaned parts (po_line_id is null)
    const orphanedParts = allParts.filter(p => !p.po_line_id);

    // Delete orphaned parts
    const deletedIds = [];
    for (const orphan of orphanedParts) {
      try {
        await base44.asServiceRole.entities.Part.delete(orphan.id);
        deletedIds.push(orphan.id);
      } catch (err) {
        console.error(`Failed to delete orphaned part ${orphan.id}:`, err.message);
      }
    }

    return Response.json({
      po_id: po.id,
      po_reference: po.po_reference,
      orphaned_parts_deleted: deletedIds.length,
      deleted_part_ids: deletedIds,
      remaining_parts_count: allParts.length - deletedIds.length
    });

  } catch (error) {
    console.error('Error cleaning up orphaned parts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});