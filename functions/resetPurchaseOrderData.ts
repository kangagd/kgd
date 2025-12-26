import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can reset data
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[RESET] Starting Purchase Order data deletion...');

    // Delete all PurchaseOrderLine records
    const lines = await base44.asServiceRole.entities.PurchaseOrderLine.list();
    let linesDeleted = 0;
    
    for (const line of lines) {
      await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
      linesDeleted++;
    }

    console.log(`[RESET] Deleted ${linesDeleted} PurchaseOrderLine records`);

    // Delete all PurchaseOrder records
    const pos = await base44.asServiceRole.entities.PurchaseOrder.list();
    let posDeleted = 0;
    
    for (const po of pos) {
      await base44.asServiceRole.entities.PurchaseOrder.delete(po.id);
      posDeleted++;
    }

    console.log(`[RESET] Deleted ${posDeleted} PurchaseOrder records`);

    return Response.json({
      success: true,
      deleted: {
        purchaseOrders: posDeleted,
        purchaseOrderLines: linesDeleted,
        total: posDeleted + linesDeleted
      }
    });

  } catch (error) {
    console.error('[RESET] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});