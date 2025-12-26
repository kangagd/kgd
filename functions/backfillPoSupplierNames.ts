import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - admin only' }, { status: 401 });
        }

        // Fetch all POs
        const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
        
        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const po of allPOs) {
            // Skip if supplier_name already exists
            if (po.supplier_name && po.supplier_name.trim()) {
                skippedCount++;
                continue;
            }

            // Skip if no supplier_id
            if (!po.supplier_id) {
                skippedCount++;
                continue;
            }

            try {
                // Fetch supplier
                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                
                if (supplier?.name) {
                    // Update PO with supplier_name
                    await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
                        supplier_name: supplier.name
                    });
                    updatedCount++;
                    console.log(`Updated PO ${po.id} with supplier_name: ${supplier.name}`);
                } else {
                    errors.push({ po_id: po.id, error: 'Supplier not found or has no name' });
                    skippedCount++;
                }
            } catch (error) {
                errors.push({ po_id: po.id, error: error.message });
                skippedCount++;
            }
        }

        return Response.json({
            success: true,
            total: allPOs.length,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});