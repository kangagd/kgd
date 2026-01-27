import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY: Enforce permission
    if (!user || user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden: Admin access required',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const body = await req.json();
    const { batch_size = 100, dryRun = true, limit = 5000 } = body;

    console.log(`[backfillPurchaseOrderLineStatus] Starting (dryRun=${dryRun}, batch_size=${batch_size}, limit=${limit})`);

    // Fetch all PurchaseOrderLine records
    const allLines = await base44.asServiceRole.entities.PurchaseOrderLine.list(undefined, limit);

    // Identify lines missing status
    const needsBackfill = allLines.filter(line => 
      !line.status || line.status === '' || line.status === null || line.status === undefined
    );

    console.log(`[backfillPurchaseOrderLineStatus] Found ${needsBackfill.length} lines needing status backfill out of ${allLines.length}`);

    const summary = {
      checked: allLines.length,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < needsBackfill.length; i += batch_size) {
      const batch = needsBackfill.slice(i, i + batch_size);
      console.log(`[backfillPurchaseOrderLineStatus] Processing batch (items ${i} to ${Math.min(i + batch_size, needsBackfill.length)})`);

      for (const line of batch) {
        try {
          if (!dryRun) {
            await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
              status: 'draft'
            });
          }
          
          console.log(`[backfillPurchaseOrderLineStatus] Updated line ${line.id} (PO: ${line.purchase_order_id})`);
          summary.updated++;
        } catch (err) {
          const errMsg = `Failed to update line ${line.id}: ${err.message}`;
          console.error(`[backfillPurchaseOrderLineStatus] ${errMsg}`);
          summary.errors.push({ line_id: line.id, po_id: line.purchase_order_id, error: err.message });
        }
      }
    }

    console.log(`[backfillPurchaseOrderLineStatus] Complete:`, summary);

    return Response.json({
      success: true,
      dryRun,
      summary
    });
  } catch (error) {
    console.error('[backfillPurchaseOrderLineStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});