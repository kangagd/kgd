import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-off backfill: Generate missing po_reference and mirror to legacy fields
 * Ensures all PO rows have po_reference and consistent legacy fields
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
      let currentPoReference = po.po_reference;

      // Ensure po_reference exists, if not, generate one from ID
      if (!currentPoReference) {
        currentPoReference = `PO-${po.id.slice(0, 8)}`;
        console.log(`[backfillPoReferenceMirrors] Generated missing po_reference for PO ${po.id}: ${currentPoReference}`);
      }

      const needsUpdate = 
        !po.po_reference ||
        po.po_number !== currentPoReference ||
        po.order_reference !== currentPoReference ||
        po.reference !== currentPoReference;
      
      if (needsUpdate) {
        console.log(`[backfillPoReferenceMirrors] Mirroring for PO ${po.id}:`, {
          po_reference: currentPoReference,
          old_po_number: po.po_number,
          old_order_reference: po.order_reference,
          old_reference: po.reference
        });
        
        await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
          po_reference: currentPoReference,
          po_number: currentPoReference,
          order_reference: currentPoReference,
          reference: currentPoReference
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