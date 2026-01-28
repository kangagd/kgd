import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEPRECATED: This function is deprecated in favor of managePurchaseOrder with action='updateStatus'
 * It now redirects all calls to managePurchaseOrder to ensure single-writer consistency.
 * 
 * This prevents conflicts where UI and background jobs update PO status differently.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { po_id, status, vehicle_id, expected_date } = await req.json();

    if (!po_id || !status) {
      return Response.json({ error: 'po_id and status are required' }, { status: 400 });
    }

    console.log('[updatePurchaseOrderStatus] DEPRECATED - Redirecting to managePurchaseOrder', { po_id, status });

    // Redirect to managePurchaseOrder
    const response = await base44.asServiceRole.functions.invoke('managePurchaseOrder', {
      action: 'updateStatus',
      id: po_id,
      status,
      vehicle_id,
      expected_date
    });

    return Response.json(response.data);
  } catch (error) {
    console.error('[updatePurchaseOrderStatus ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});