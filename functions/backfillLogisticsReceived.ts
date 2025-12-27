import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        // Find all completed logistics jobs with a PO
        const allJobs = await base44.asServiceRole.entities.Job.list();
        const completedLogisticsJobs = allJobs.filter(job => 
            job.status === 'Completed' && 
            job.purchase_order_id && 
            job.checked_items &&
            Object.keys(job.checked_items).length > 0
        );

        console.log(`Found ${completedLogisticsJobs.length} completed logistics jobs with checked items`);

        let processedCount = 0;
        let updatedPOLines = 0;
        let updatedPOs = 0;

        for (const job of completedLogisticsJobs) {
            const checkedItems = job.checked_items || {};
            const checkedItemIds = Object.keys(checkedItems).filter(itemId => checkedItems[itemId]);

            if (checkedItemIds.length === 0) continue;

            // Get all PO lines for this PO
            const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
                purchase_order_id: job.purchase_order_id
            });

            // Mark checked items as received
            for (const line of poLines) {
                if (checkedItemIds.includes(line.id) && line.quantity_received < line.quantity_ordered) {
                    await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
                        quantity_received: line.quantity_ordered,
                        received_at: job.updated_date || new Date().toISOString()
                    });
                    updatedPOLines++;
                }
            }

            // Update PO status if needed
            const allLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
                purchase_order_id: job.purchase_order_id
            });
            const allReceived = allLines.every(line => line.quantity_received >= line.quantity_ordered);
            const someReceived = allLines.some(line => line.quantity_received > 0);

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
            
            if (allReceived && po.status !== 'received') {
                await base44.asServiceRole.entities.PurchaseOrder.update(job.purchase_order_id, {
                    status: 'received'
                });
                updatedPOs++;
            } else if (someReceived && po.status === 'sent') {
                await base44.asServiceRole.entities.PurchaseOrder.update(job.purchase_order_id, {
                    status: 'partially_received'
                });
                updatedPOs++;
            }

            processedCount++;
        }

        return Response.json({ 
            success: true,
            jobsProcessed: processedCount,
            poLinesUpdated: updatedPOLines,
            posUpdated: updatedPOs
        });
    } catch (error) {
        console.error('Backfill error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});