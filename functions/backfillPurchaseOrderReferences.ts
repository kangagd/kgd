import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time backfill script to populate po_number for existing POs
 * that only have legacy reference/order_reference fields
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Only allow admins to run this
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const pos = await base44.asServiceRole.entities.PurchaseOrder.list();
        
        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (const po of pos) {
            try {
                // Skip if po_number is already set
                if (po.po_number) {
                    skipped++;
                    continue;
                }

                // Copy from legacy fields to po_reference
                const legacyRef = po.po_number || po.order_reference || po.reference;
                const updateData = {};
                
                if (!po.po_reference && legacyRef) {
                    updateData.po_reference = legacyRef;
                }
                
                // Mirror to po_number for compatibility
                if (po.po_reference && !po.po_number) {
                    updateData.po_number = po.po_reference;
                } else if (!po.po_number && legacyRef) {
                    updateData.po_number = legacyRef;
                }
                
                if (Object.keys(updateData).length > 0) {
                    await base44.asServiceRole.entities.PurchaseOrder.update(po.id, updateData);
                    updated++;
                } else {
                    skipped++;
                }
            } catch (error) {
                errors.push({ po_id: po.id, error: error.message });
            }
        }

        return Response.json({
            success: true,
            total: pos.length,
            updated,
            skipped,
            errors: errors.length > 0 ? errors : null,
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});