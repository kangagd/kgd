import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time migration script to populate po_reference from legacy fields
 * Run once by admin to clean up existing Purchase Order data
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }
        
        // Get all purchase orders
        const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
        
        let updated = 0;
        let skipped = 0;
        let errors = [];
        
        for (const po of allPOs) {
            try {
                const updateData = {};
                let needsUpdate = false;
                
                // Backfill po_reference from legacy fields (priority order)
                if (!po.po_reference || !po.po_reference.trim()) {
                    const legacyRef = po.po_number || po.order_reference || po.reference;
                    if (legacyRef && legacyRef.trim()) {
                        updateData.po_reference = legacyRef.trim();
                        needsUpdate = true;
                    }
                }
                
                // Mirror po_reference to po_number for legacy compatibility
                if (po.po_reference && (!po.po_number || !po.po_number.trim())) {
                    updateData.po_number = po.po_reference;
                    needsUpdate = true;
                }
                
                // Mirror po_reference to order_reference if empty
                if (po.po_reference && (!po.order_reference || !po.order_reference.trim())) {
                    updateData.order_reference = po.po_reference;
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await base44.asServiceRole.entities.PurchaseOrder.update(po.id, updateData);
                    updated++;
                    console.log(`✅ Updated PO ${po.id}: po_reference = ${updateData.po_reference || po.po_reference}`);
                } else {
                    skipped++;
                }
            } catch (error) {
                errors.push({
                    po_id: po.id,
                    error: error.message
                });
                console.error(`❌ Error updating PO ${po.id}:`, error.message);
            }
        }
        
        return Response.json({
            success: true,
            summary: {
                total: allPOs.length,
                updated,
                skipped,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined,
            message: `Migration complete: ${updated} POs updated, ${skipped} skipped, ${errors.length} errors`
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});