import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all loading bay delivery stops
    const allStops = await base44.asServiceRole.entities.LogisticsStop.filter({
      purpose: 'po_delivery_loading_bay'
    });

    console.log(`Found ${allStops.length} loading bay delivery stops`);

    // Get all confirmations for these stops
    const stopIds = allStops.map(s => s.id);
    const allConfirmations = await base44.asServiceRole.entities.StopConfirmation.filter({
      stop_id: { $in: stopIds }
    });

    console.log(`Found ${allConfirmations.length} confirmations for these stops`);

    // Get all receipts linked to these stops/confirmations
    const confirmationIds = allConfirmations.map(c => c.id);
    const existingReceipts = await base44.asServiceRole.entities.Receipt.filter({
      $or: [
        { source_stop_id: { $in: stopIds } },
        { source_confirmation_id: { $in: confirmationIds } }
      ]
    });

    const existingReceiptStopIds = new Set(existingReceipts.map(r => r.source_stop_id).filter(Boolean));
    const existingReceiptConfirmationIds = new Set(existingReceipts.map(r => r.source_confirmation_id).filter(Boolean));

    console.log(`Found ${existingReceipts.length} existing receipts`);

    // Find confirmations without receipts
    const missing = [];
    for (const confirmation of allConfirmations) {
      if (!existingReceiptConfirmationIds.has(confirmation.id)) {
        const stop = allStops.find(s => s.id === confirmation.stop_id);
        if (stop && !existingReceiptStopIds.has(stop.id)) {
          missing.push({
            stop_id: stop.id,
            confirmation_id: confirmation.id,
            project_id: stop.project_id || null,
            purchase_order_id: stop.purchase_order_id || null,
            completed_at: confirmation.completed_at,
            completed_by: confirmation.completed_by_name
          });
        }
      }
    }

    return Response.json({ 
      total_stops: allStops.length,
      total_confirmations: allConfirmations.length,
      existing_receipts: existingReceipts.length,
      missing_receipts: missing.length,
      missing: missing
    });

  } catch (error) {
    console.error('Error in auditMissingReceiptsForLoadingBayStops:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});