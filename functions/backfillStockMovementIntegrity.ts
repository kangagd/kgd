import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Normalize legacy source values to canonical forms
 */
function normalizeMovementSource(source) {
  if (!source) return 'legacy';
  
  const normalized = String(source).toLowerCase().trim();
  
  // Legacy → canonical mapping
  const mapping = {
    'po_receipt': 'purchase_order_receipt',
    'po_receive': 'purchase_order_receipt',
    'logistics_job': 'logistics_transfer',
    'logistics_transfer': 'logistics_transfer',
    'job_usage': 'job_usage',
    'job_completion_usage': 'job_usage',
    'transfer': 'transfer',
    'adjustment': 'adjustment',
  };
  
  return mapping[normalized] || 'legacy';
}

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
    const { batch_size = 50, dryRun = true, limit = 1000 } = body;

    console.log(`[backfillStockMovementIntegrity] Starting (dryRun=${dryRun}, batch_size=${batch_size}, limit=${limit})`);

    // Fetch all StockMovement records (with limit to avoid memory issues)
    const allMovements = await base44.asServiceRole.entities.StockMovement.list(undefined, limit);
    
    // Identify movements that need backfill
    const needsBackfill = allMovements.filter(m => {
      const hasMissingIdempotencyKey = !m.idempotency_key;
      const hasInvalidSource = !['purchase_order_receipt', 'logistics_transfer', 'job_usage', 'transfer', 'adjustment', 'legacy'].includes(m.source);
      const hasMissingSku = !m.item_sku;
      
      return hasMissingIdempotencyKey || hasInvalidSource || hasMissingSku;
    });

    console.log(`[backfillStockMovementIntegrity] Found ${needsBackfill.length} movements needing backfill out of ${allMovements.length}`);

    const summary = {
      checked: allMovements.length,
      needs_backfill: needsBackfill.length,
      updated: 0,
      updated_idempotency: 0,
      updated_source: 0,
      updated_sku: 0,
      errors: [],
      batches_processed: 0
    };

    // Process in batches
    for (let i = 0; i < needsBackfill.length; i += batch_size) {
      const batch = needsBackfill.slice(i, i + batch_size);
      console.log(`[backfillStockMovementIntegrity] Processing batch ${summary.batches_processed + 1} (${batch.length} items)`);

      for (const movement of batch) {
        try {
          const updatePayload = {};
          let changed = false;

          // 1. Backfill idempotency_key
          if (!movement.idempotency_key) {
            updatePayload.idempotency_key = `legacy:${movement.id}`;
            summary.updated_idempotency++;
            changed = true;
          }

          // 2. Normalize source
          const normalizedSource = normalizeMovementSource(movement.source);
          if (normalizedSource !== movement.source) {
            updatePayload.source = normalizedSource;
            summary.updated_source++;
            changed = true;
          }

          // 3. Best-effort SKU backfill
          if (!movement.item_sku && movement.price_list_item_id) {
            try {
              const priceListItem = await base44.asServiceRole.entities.PriceListItem.get(movement.price_list_item_id);
              if (priceListItem && (priceListItem.sku || priceListItem.item_code)) {
                updatePayload.item_sku = priceListItem.sku || priceListItem.item_code;
                summary.updated_sku++;
                changed = true;
              }
            } catch (err) {
              console.warn(`[backfillStockMovementIntegrity] Could not fetch PriceListItem ${movement.price_list_item_id}: ${err.message}`);
              // Continue - item_sku will remain null, which is acceptable
            }
          }

          // Apply update if anything changed
          if (changed && !dryRun) {
            try {
              await base44.asServiceRole.entities.StockMovement.update(movement.id, updatePayload);
              summary.updated++;
            } catch (err) {
              const errMsg = `Failed to update movement ${movement.id}: ${err.message}`;
              console.error(`[backfillStockMovementIntegrity] ${errMsg}`);
              summary.errors.push({ movement_id: movement.id, error: err.message });
            }
          } else if (changed && dryRun) {
            summary.updated++;
          }
        } catch (err) {
          const errMsg = `Error processing movement ${movement.id}: ${err.message}`;
          console.error(`[backfillStockMovementIntegrity] ${errMsg}`);
          summary.errors.push({ movement_id: movement.id, error: err.message });
        }
      }

      summary.batches_processed++;
    }

    console.log(`[backfillStockMovementIntegrity] Complete:`, summary);

    return Response.json({
      success: true,
      dryRun,
      summary
    });
  } catch (error) {
    console.error('[backfillStockMovementIntegrity] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});