import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { stop_confirmation_id } = body;

    if (!stop_confirmation_id) {
      return Response.json({ 
        success: false, 
        error: 'stop_confirmation_id is required' 
      }, { status: 400 });
    }

    // Load StopConfirmation
    const confirmation = await base44.asServiceRole.entities.StopConfirmation.get(stop_confirmation_id);
    if (!confirmation) {
      return Response.json({ 
        success: false, 
        error: 'StopConfirmation not found' 
      }, { status: 404 });
    }

    // Load LogisticsStop
    const stop = await base44.asServiceRole.entities.LogisticsStop.get(confirmation.stop_id);
    if (!stop) {
      return Response.json({ 
        success: false, 
        error: 'LogisticsStop not found' 
      }, { status: 404 });
    }

    // Only process clear_loading_bay stops
    if (stop.purpose !== 'clear_loading_bay') {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'not_clear_loading_bay'
      });
    }

    // Find receipt - prefer stop.receipt_id, fallback to best-effort lookup
    let receiptId = stop.receipt_id;
    
    if (!receiptId) {
      // Best-effort fallback: find receipt by clear_run_id and project_id
      const fallbackReceipts = await base44.asServiceRole.entities.Receipt.filter({
        clear_run_id: stop.run_id,
        status: 'open'
      });
      
      if (fallbackReceipts.length === 0) {
        return Response.json({
          success: false,
          reason: 'missing_receipt_link'
        }, { status: 404 });
      }
      
      // If project_id matches, prefer that one
      const matchingReceipt = stop.project_id 
        ? fallbackReceipts.find(r => r.project_id === stop.project_id)
        : fallbackReceipts[0];
      
      receiptId = matchingReceipt ? matchingReceipt.id : fallbackReceipts[0].id;
      console.log(`[markReceiptCleared] Used fallback lookup for receipt: ${receiptId}`);
    }

    // Load receipt
    const receipt = await base44.asServiceRole.entities.Receipt.get(receiptId);
    if (!receipt) {
      return Response.json({
        success: false,
        reason: 'receipt_not_found'
      }, { status: 404 });
    }

    // Check if already cleared (idempotency)
    if (receipt.status === 'cleared') {
      return Response.json({
        success: true,
        existed: true,
        receipt_id: receipt.id
      });
    }

    // Mark receipt as cleared
    await base44.asServiceRole.entities.Receipt.update(receipt.id, {
      status: 'cleared',
      cleared_at: confirmation.completed_at || new Date().toISOString(),
      cleared_by_name: confirmation.completed_by_name || 'system'
    });

    console.log(`[markReceiptCleared] Marked receipt ${receipt.id} as cleared from confirmation ${confirmation.id}`);

    return Response.json({
      success: true,
      receipt_id: receipt.id,
      updated: true
    });

  } catch (error) {
    console.error('[markReceiptCleared] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});