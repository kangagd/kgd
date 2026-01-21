import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all POs
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    
    const duplicateSummary = [];

    // Check each PO for duplicate parts
    for (const po of allPOs) {
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

      // If we found more unique parts than PO lines, there's likely a problem
      const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
        purchase_order_id: po.id
      });

      if (uniqueParts.length > poLines.length) {
        duplicateSummary.push({
          po_id: po.id,
          po_reference: po.po_reference,
          po_lines_count: poLines.length,
          unique_parts_count: uniqueParts.length,
          primary_count: partsByPrimary.length,
          legacy_count: partsByLegacy.length,
          parts: uniqueParts.map(p => ({
            id: p.id,
            item_name: p.item_name,
            po_line_id: p.po_line_id,
            primary_po: p.primary_purchase_order_id,
            legacy_po: p.purchase_order_id
          }))
        });
      }
    }

    return Response.json({
      total_pos: allPOs.length,
      pos_with_duplicate_parts: duplicateSummary.length,
      duplicates: duplicateSummary
    });

  } catch (error) {
    console.error('Error checking duplicate parts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});