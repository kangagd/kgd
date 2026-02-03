import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // First, run audit to find missing receipts
    const auditResponse = await base44.functions.invoke('auditMissingReceiptsForLoadingBayStops', {});
    const auditData = auditResponse.data;

    if (!auditData.missing || auditData.missing.length === 0) {
      return Response.json({ 
        message: 'No missing receipts found',
        checked: 0,
        created: 0,
        existed: 0,
        failed: 0
      });
    }

    console.log(`Found ${auditData.missing.length} missing receipts to backfill`);

    const results = {
      checked: auditData.missing.length,
      created: 0,
      existed: 0,
      failed: 0,
      details: []
    };

    // Process each missing receipt
    for (const item of auditData.missing) {
      try {
        const response = await base44.functions.invoke('ensureReceiptForStopConfirmation', {
          stop_confirmation_id: item.confirmation_id
        });

        const result = response.data;
        
        if (result.success) {
          if (result.existed) {
            results.existed++;
            results.details.push({
              confirmation_id: item.confirmation_id,
              status: 'existed',
              receipt_id: result.receipt_id
            });
          } else if (result.skipped) {
            results.details.push({
              confirmation_id: item.confirmation_id,
              status: 'skipped',
              reason: result.reason
            });
          } else {
            results.created++;
            results.details.push({
              confirmation_id: item.confirmation_id,
              status: 'created',
              receipt_id: result.receipt_id
            });
          }
        } else {
          results.failed++;
          results.details.push({
            confirmation_id: item.confirmation_id,
            status: 'failed',
            error: result.reason || result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          confirmation_id: item.confirmation_id,
          status: 'error',
          error: error.message
        });
        console.error(`Error backfilling receipt for confirmation ${item.confirmation_id}:`, error);
      }
    }

    return Response.json(results);

  } catch (error) {
    console.error('Error in backfillReceiptsForLoadingBayStops:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});