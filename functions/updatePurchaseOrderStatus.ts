import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;
  const s = status.toLowerCase().replace(/[_\s-]/g, '_');
  
  const map = {
    'draft': PO_STATUS.DRAFT,
    'sent': PO_STATUS.SENT,
    'on_order': PO_STATUS.ON_ORDER,
    'in_transit': PO_STATUS.IN_TRANSIT,
    'in_loading_bay': PO_STATUS.IN_LOADING_BAY,
    'received': PO_STATUS.IN_LOADING_BAY,
    'delivered': PO_STATUS.IN_LOADING_BAY,
    'in_storage': PO_STATUS.IN_STORAGE,
    'in_vehicle': PO_STATUS.IN_VEHICLE,
    'installed': PO_STATUS.INSTALLED,
    'cancelled': PO_STATUS.CANCELLED,
  };
  
  return map[s] || status;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, status } = await req.json();
        
        if (!id || !status) {
            return Response.json({ error: 'id and status required' }, { status: 400 });
        }

        const normalizedStatus = normaliseLegacyPoStatus(status);
        const validStatuses = Object.values(PO_STATUS);
        
        if (!validStatuses.includes(normalizedStatus)) {
            return Response.json({ 
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            }, { status: 400 });
        }

        const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
        if (!po) {
            return Response.json({ error: 'PO not found' }, { status: 404 });
        }

        const updateData = { status: normalizedStatus };
        
        if (normalizedStatus === PO_STATUS.ON_ORDER) {
            updateData.sent_at = new Date().toISOString();
        } else if (normalizedStatus === PO_STATUS.IN_LOADING_BAY) {
            updateData.arrived_at = new Date().toISOString();
        }

        const updated = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);
        
        return Response.json({ success: true, purchaseOrder: updated });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});