import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lightweight hash helpers (inline for now)
function stableSortedIds(ids) {
  return [...ids].sort();
}

function hashIds(ids) {
  const sorted = stableSortedIds(ids);
  const joined = sorted.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(joined);
  const base64 = btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
}

function buildClearLoadingBayIntentKey(receiptIds) {
  const hash = hashIds(receiptIds);
  return `clear_loading_bay:${hash}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin authorization
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      receipt_ids, 
      assigned_to_user_id, 
      assigned_to_name,
      vehicle_id,
      vehicle_name,
      target_location_id
    } = body;

    if (!receipt_ids || !Array.isArray(receipt_ids) || receipt_ids.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'receipt_ids is required and must be a non-empty array' 
      }, { status: 400 });
    }

    // Build intent key for idempotency
    const intent_key = buildClearLoadingBayIntentKey(receipt_ids);
    const intent_kind = 'clear_loading_bay';
    const intent_meta_json = JSON.stringify({ receipt_ids });

    console.log(`[createClearRun] Intent key: ${intent_key}`);

    // Fetch receipts
    const receipts = await Promise.all(
      receipt_ids.map(id => base44.asServiceRole.entities.Receipt.get(id).catch(() => null))
    );

    const eligibleReceipts = [];
    const skippedReceipts = [];

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i];
      const receiptId = receipt_ids[i];

      if (!receipt) {
        skippedReceipts.push({ id: receiptId, reason: 'not_found' });
        continue;
      }

      if (receipt.status !== 'open') {
        skippedReceipts.push({ id: receiptId, reason: 'not_open' });
        continue;
      }

      if (receipt.clear_run_id) {
        skippedReceipts.push({ id: receiptId, reason: 'already_linked_to_run', run_id: receipt.clear_run_id });
        continue;
      }

      eligibleReceipts.push(receipt);
    }

    if (eligibleReceipts.length === 0) {
      return Response.json({
        success: true,
        run_id: null,
        created_stops: 0,
        skipped_receipts: skippedReceipts,
        message: 'No eligible receipts to process'
      });
    }

    // Build stops data
    const stopsDraftData = eligibleReceipts.map((receipt, idx) => {
      const stopData = {
        purpose: 'clear_loading_bay',
        instructions: 'Clear Loading Bay receipt'
      };

      if (receipt.location_id) stopData.location_id = receipt.location_id;
      if (target_location_id) stopData.to_location_id = target_location_id;
      if (receipt.project_id) stopData.project_id = receipt.project_id;
      if (receipt.purchase_order_id) stopData.purchase_order_id = receipt.purchase_order_id;
      if (receipt.id) stopData.receipt_id = receipt.id;

      return stopData;
    });

    // Use get-or-create function
    const runDraftData = {
      notes: 'Auto-created from Loading Bay dashboard'
    };
    if (assigned_to_user_id) runDraftData.assigned_to_user_id = assigned_to_user_id;
    if (assigned_to_name) runDraftData.assigned_to_name = assigned_to_name;
    if (vehicle_id) runDraftData.vehicle_id = vehicle_id;

    const getOrCreateResult = await base44.functions.invoke('getOrCreateLogisticsRun', {
      intent_key,
      intent_kind,
      intent_meta_json,
      runDraftData,
      stopsDraftData
    });

    if (!getOrCreateResult.data?.run) {
      return Response.json({
        success: false,
        error: 'Failed to get or create run'
      }, { status: 500 });
    }

    const run = getOrCreateResult.data.run;
    const reused = getOrCreateResult.data.reused;

    console.log(`[createClearRun] ${reused ? 'Reused' : 'Created'} run ${run.id} for ${eligibleReceipts.length} receipts`);

    // Update receipts with clear_run_id (only if new run was created)
    let updatedReceipts = 0;
    if (!reused) {
      for (const receipt of eligibleReceipts) {
        try {
          await base44.asServiceRole.entities.Receipt.update(receipt.id, {
            clear_run_id: run.id
          });
          updatedReceipts++;
        } catch (error) {
          console.error(`[createClearRun] Failed to link receipt ${receipt.id}:`, error);
        }
      }
    }

    const createdStops = reused ? 0 : stopsDraftData.length;

    return Response.json({
      success: true,
      run_id: run.id,
      created_stops: createdStops,
      skipped_receipts: skippedReceipts
    });

  } catch (error) {
    console.error('[createClearRun] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});