import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { po_id } = await req.json();

    // Get PO and its lines
    const po = await base44.entities.PurchaseOrder.get(po_id);
    const lines = await base44.entities.PurchaseOrderLine.filter({ purchase_order_id: po_id });

    // For each line, check if part exists
    const linePartData = await Promise.all(lines.map(async (line) => {
      let part = null;
      if (line.part_id) {
        try {
          part = await base44.entities.Part.get(line.part_id);
        } catch (e) {
          part = { error: 'part_id exists but part not found' };
        }
      }
      
      return {
        line_id: line.id,
        item_name: line.item_name,
        part_id: line.part_id || null,
        part_data: part ? {
          id: part.id,
          item_name: part.item_name,
          po_line_id: part.po_line_id || null,
          project_id: part.project_id || null,
          status: part.status,
          category: part.category
        } : null
      };
    }));

    return Response.json({
      po_id,
      project_id: po.project_id,
      line_count: lines.length,
      lines: linePartData
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});