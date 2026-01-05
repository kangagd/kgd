import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;
  const s = status.toLowerCase().replace(/[_\s-]/g, '_');
  
  const map = {
    'draft': PO_STATUS.DRAFT,
    'sent': PO_STATUS.SENT,
    'on_order': PO_STATUS.ON_ORDER,
    'in_transit': PO_STATUS.IN_TRANSIT,
    'in_loading_bay': PO_STATUS.IN_LOADING_BAY,
    'at_supplier': PO_STATUS.AT_SUPPLIER,
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
        
        // Auto-create Logistics Job if conditions are met
        let logisticsJob = null;
        const shouldHaveLogisticsJob =
            !updated.linked_logistics_job_id &&
            (
                (updated.delivery_method === 'delivery' && normalizedStatus === PO_STATUS.IN_LOADING_BAY) ||
                (updated.delivery_method === 'pickup' && normalizedStatus === PO_STATUS.AT_SUPPLIER)
            );

        if (shouldHaveLogisticsJob) {
            try {
                const jobResponse = await base44.asServiceRole.functions.invoke("createLogisticsJobForPO", {
                    purchase_order_id: updated.id,
                    scheduled_date: updated.expected_date || new Date().toISOString().split("T")[0],
                });

                if (jobResponse?.data?.success && jobResponse.data?.job) {
                    logisticsJob = jobResponse.data.job;
                    await base44.asServiceRole.entities.PurchaseOrder.update(updated.id, {
                        linked_logistics_job_id: logisticsJob.id,
                    });
                    updated.linked_logistics_job_id = logisticsJob.id;
                }
            } catch (error) {
                console.error("Error auto-creating logistics job:", error);
            }
        }
        
        return Response.json({ 
            success: true, 
            purchaseOrder: updated,
            ...(logisticsJob ? { logisticsJob } : {})
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});