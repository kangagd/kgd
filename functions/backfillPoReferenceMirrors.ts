import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-off backfill: Mirror po_reference to legacy fields
 * Ensures old PO rows have consistent legacy fields for any fallback UI
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin-only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    // Fetch all POs
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    
    console.log(`[backfillPoReferenceMirrors] Found ${allPOs.length} POs`);

    const updates = [];
    
    for (const po of allPOs) {
      const needsUpdate = 
        po.po_reference && (
          po.po_number !== po.po_reference ||
          po.order_reference !== po.po_reference ||
          po.reference !== po.po_reference
        );
      
      if (needsUpdate) {
        console.log(`[backfillPoReferenceMirrors] Mirroring for PO ${po.id}:`, {
          po_reference: po.po_reference,
          old_po_number: po.po_number,
          old_order_reference: po.order_reference,
          old_reference: po.reference
        });
        
        await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
          po_number: po.po_reference,
          order_reference: po.po_reference,
          reference: po.po_reference
        });
        
        updates.push(po.id);
      }
    }

    console.log(`[backfillPoReferenceMirrors] Updated ${updates.length} POs`);

    return Response.json({
      success: true,
      totalPOs: allPOs.length,
      updatedCount: updates.length,
      updatedIds: updates
    });
    
  } catch (error) {
    console.error('[backfillPoReferenceMirrors] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});