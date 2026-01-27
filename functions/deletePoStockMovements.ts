import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.extended_role !== 'manager')) {
      return Response.json({ error: 'Unauthorized - admin or manager only' }, { status: 403 });
    }

    const { po_id } = await req.json();

    if (!po_id) {
      return Response.json({ error: 'PO ID is required' }, { status: 400 });
    }

    // Get all stock movements for this PO
    const movements = await base44.asServiceRole.entities.StockMovement.filter({
      reference_type: 'purchase_order',
      reference_id: po_id
    });

    console.log(`Found ${movements.length} stock movements for PO ${po_id}`);

    // Delete all movements
    for (const movement of movements) {
      await base44.asServiceRole.entities.StockMovement.delete(movement.id);
    }

    // Reset qty_received on all PO lines
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po_id
    });

    for (const line of poLines) {
      await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
        qty_received: 0
      });
    }

    // Reset PO status to pending or draft
    await base44.asServiceRole.entities.PurchaseOrder.update(po_id, {
      status: 'pending',
      stock_transfer_status: 'not_started'
    });

    return Response.json({
      success: true,
      movements_deleted: movements.length,
      lines_reset: poLines.length
    });
  } catch (error) {
    console.error('Error deleting PO stock movements:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});