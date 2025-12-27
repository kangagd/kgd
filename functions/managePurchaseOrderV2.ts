import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

// Canonical PO status values (stored in DB)
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

// Normalize legacy status values to canonical ones
function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  switch (status.toLowerCase()) {
    case "draft":
      return PO_STATUS.DRAFT;
    
    case "sent":
      return PO_STATUS.SENT;

    case "on_order":
    case "on order":
      return PO_STATUS.ON_ORDER;

    case "partially_received":
    case "in_transit":
    case "in transit":
      return PO_STATUS.IN_TRANSIT;

    case "received":
    case "delivered":
    case "delivered - loading bay":
    case "delivered_loading_bay":
    case "delivered to delivery bay":
    case "delivered to loading bay":
    case "delivered_to_delivery_bay":
    case "ready for pick up":
    case "ready to pick up":
    case "ready_to_pick_up":
    case "arrived":
    case "at_delivery_bay":
    case "at delivery bay":
    case "in_delivery_bay":
    case "in delivery bay":
    case "loadingbay":
    case "in_loading_bay":
    case "in loading bay":
      return PO_STATUS.IN_LOADING_BAY;

    case "in_storage":
    case "in storage":
    case "completed - in storage":
      return PO_STATUS.IN_STORAGE;

    case "in_vehicle":
    case "in vehicle":
    case "completed - in vehicle":
      return PO_STATUS.IN_VEHICLE;

    case "installed":
      return PO_STATUS.INSTALLED;

    case "cancelled":
      return PO_STATUS.CANCELLED;

    default:
      return status;
  }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, status } = await req.json();

        console.log('[managePurchaseOrderV2] action=' + action, 'po=' + id, 'user=' + user.email);

        // Action: updateStatus
        if (action === 'updateStatus') {
            if (!id || !status) {
                return Response.json({ error: 'id and status are required' }, { status: 400 });
            }

            // Normalize the status first before validation
            const normalizedStatus = normaliseLegacyPoStatus(status);
            
            const validStatuses = Object.values(PO_STATUS);
            
            console.log('[PO updateStatus] pure status update', { id, status: normalizedStatus });
            
            if (!validStatuses.includes(normalizedStatus)) {
                return Response.json({ 
                    error: `Invalid status "${status}" (normalized: "${normalizedStatus}"). Must be one of: ${validStatuses.join(', ')}` 
                }, { status: 400 });
            }

            // Forward to main function
            const response = await base44.asServiceRole.functions.invoke('managePurchaseOrder', {
                action: 'updateStatus',
                id,
                status: normalizedStatus
            });

            return Response.json(response.data);
        }

        return Response.json({ error: 'Invalid action. Use managePurchaseOrder directly.' }, { status: 400 });

    } catch (error) {
        console.error('[managePurchaseOrderV2] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});