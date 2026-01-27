import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find all parts with po_line_id but missing project_id
    const parts = await base44.asServiceRole.entities.Part.list('-created_date', 1000);
    
    const orphaned = parts.filter(p => 
      p.po_line_id && p.part_scope === 'project' && !p.project_id
    );

    // Get PO details for each orphaned part
    const details = await Promise.all(orphaned.map(async (part) => {
      let poReference = null;
      try {
        const line = await base44.entities.PurchaseOrderLine.get(part.po_line_id);
        const po = await base44.entities.PurchaseOrder.get(line.purchase_order_id);
        poReference = po.po_reference;
      } catch (e) {
        // PO line/PO may not exist
      }
      
      return {
        part_id: part.id,
        item_name: part.item_name,
        po_line_id: part.po_line_id,
        po_reference: poReference,
        created_at: part.created_date
      };
    }));

    return Response.json({
      count: orphaned.length,
      parts: details
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});