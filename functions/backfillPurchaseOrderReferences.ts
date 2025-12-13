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

                // Copy from reference or order_reference to po_number
                const legacyRef = po.reference || po.order_reference;
                if (legacyRef) {
                    await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
                        po_number: legacyRef,
                        order_reference: legacyRef,
                        reference: legacyRef,
                    });
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