import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all PurchaseOrderLines
    const allLines = await base44.asServiceRole.entities.PurchaseOrderLine.list();
    
    // Delete all lines
    for (const line of allLines) {
      await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
    }

    // Fetch all PurchaseOrders
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    
    // Delete all POs
    for (const po of allPOs) {
      await base44.asServiceRole.entities.PurchaseOrder.delete(po.id);
    }

    const linesDeleted = allLines.length;
    const posDeleted = allPOs.length;

    console.log(`[adminNukePOSystem] Deleted ${linesDeleted} lines, ${posDeleted} POs`);

    return Response.json({
      success: true,
      deleted: {
        purchaseOrderLines: linesDeleted,
        purchaseOrders: posDeleted
      }
    });

  } catch (error) {
    console.error('[adminNukePOSystem] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});