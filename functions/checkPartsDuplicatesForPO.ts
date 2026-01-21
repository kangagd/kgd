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

    // Get parts from both lookups
    const partsByPrimary = await base44.asServiceRole.entities.Part.filter({
      primary_purchase_order_id: po.id
    });
    
    const partsByLegacy = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id: po.id
    });

    // Deduplicate by ID
    const uniqueMap = new Map();
    [...partsByPrimary, ...partsByLegacy].forEach(p => uniqueMap.set(p.id, p));
    const uniqueParts = Array.from(uniqueMap.values());

    // Get PO lines
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po.id
    });

    return Response.json({
      po_id: po.id,
      po_reference: po.po_reference,
      po_lines_count: poLines.length,
      parts_by_primary: partsByPrimary.length,
      parts_by_legacy: partsByLegacy.length,
      unique_parts_count: uniqueParts.length,
      has_duplicates: uniqueParts.length > poLines.length,
      parts: uniqueParts.map(p => ({
        id: p.id,
        item_name: p.item_name,
        po_line_id: p.po_line_id,
        primary_po: p.primary_purchase_order_id,
        legacy_po: p.purchase_order_id
      })),
      po_lines: poLines.map(l => ({
        id: l.id,
        item_name: l.item_name,
        qty_ordered: l.qty_ordered
      }))
    });

  } catch (error) {
    console.error('Error checking parts for PO:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});