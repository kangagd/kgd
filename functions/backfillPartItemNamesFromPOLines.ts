import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Find all Parts with missing or empty item_name
        const partsNeedingUpdate = await base44.asServiceRole.entities.Part.filter({
            $or: [
                { item_name: { $exists: false } },
                { item_name: null },
                { item_name: '' }
            ]
        });

        console.log(`Found ${partsNeedingUpdate.length} parts with missing item_name`);

        // Get all PO lines for lookup
        const allPOLines = await base44.asServiceRole.entities.PurchaseOrderLine.list();
        const poLineMap = new Map(allPOLines.map(line => [line.id, line]));

        // Get all POs for lookup
        const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
        const poMap = new Map(allPOs.map(po => [po.id, po]));

        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (const part of partsNeedingUpdate) {
            let updateData = {};
            let poLine = null;

            // Try to find the PO line
            if (part.po_line_id) {
                poLine = poLineMap.get(part.po_line_id);
            } else {
                // Try to find PO line via primary_purchase_order_id or purchase_order_id
                const poId = part.primary_purchase_order_id || part.purchase_order_id;
                if (poId) {
                    // Find the PO line that matches this part
                    poLine = allPOLines.find(line => 
                        line.purchase_order_id === poId && 
                        line.source_id === part.id
                    );
                    
                    // If still not found, try to match by item in the PO
                    if (!poLine) {
                        const poLines = allPOLines.filter(line => line.purchase_order_id === poId);
                        if (poLines.length === 1) {
                            // If there's only one line in the PO, it's likely this one
                            poLine = poLines[0];
                        }
                    }
                }
            }

            if (poLine && poLine.item_name) {
                updateData.item_name = poLine.item_name;
                
                // Also set po_line_id if missing
                if (!part.po_line_id) {
                    updateData.po_line_id = poLine.id;
                }
                
                // Sync quantity if it's a mismatch
                if (poLine.qty_ordered && part.quantity_required !== poLine.qty_ordered) {
                    updateData.quantity_required = poLine.qty_ordered;
                }

                try {
                    await base44.asServiceRole.entities.Part.update(part.id, updateData);
                    updated++;
                    console.log(`Updated Part ${part.id}: ${updateData.item_name}`);
                } catch (err) {
                    errors.push({ partId: part.id, error: err.message });
                    console.error(`Failed to update Part ${part.id}:`, err);
                }
            } else {
                skipped++;
                console.log(`Skipped Part ${part.id}: no matching PO line found`);
            }
        }

        return Response.json({
            success: true,
            total: partsNeedingUpdate.length,
            updated,
            skipped,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error in backfillPartItemNamesFromPOLines:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});