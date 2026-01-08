import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list('-updated_date', 5);

    const purchaseOrders = allPOs.filter(po => 
      po.status !== 'received' && 
      po.status !== 'installed' &&
      po.status !== 'cancelled' &&
      po.status !== 'in_storage'
    ).slice(0, 5);

    return Response.json({ purchaseOrders: purchaseOrders || [] });

  } catch (error) {
    console.error('[getActivePurchaseOrders] Error:', error);
    return Response.json({ 
      purchaseOrders: [], 
      error: 'Failed to fetch purchase orders' 
    }, { status: 200 });
  }
});