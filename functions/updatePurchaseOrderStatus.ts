import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// NEW FUNCTION - BYPASS CACHE ISSUE
const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const VALID_STATUSES = Object.values(PO_STATUS);

console.log('[updatePurchaseOrderStatus] Valid statuses:', VALID_STATUSES);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { po_id, status } = await req.json();

    if (!po_id || !status) {
      return Response.json({ error: 'po_id and status are required' }, { status: 400 });
    }

    const normalizedStatus = status.toLowerCase().replace(/[\s-]+/g, '_');

    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return Response.json({ 
        error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}` 
      }, { status: 400 });
    }

    const po = await base44.asServiceRole.entities.PurchaseOrder.get(po_id);
    if (!po) {
      return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    const updateData = { status: normalizedStatus };

    if (normalizedStatus === PO_STATUS.ON_ORDER) {
      updateData.sent_at = new Date().toISOString();
    } else if (normalizedStatus === PO_STATUS.IN_LOADING_BAY) {
      updateData.arrived_at = new Date().toISOString();
    }

    const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(po_id, updateData);

    return Response.json({ success: true, purchaseOrder: updatedPO });
  } catch (error) {
    console.error('[updatePurchaseOrderStatus ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});