import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { v4 as uuidv4 } from 'npm:uuid@9.0.0';

/**
 * BASELINE STOCK SEED FUNCTION
 * 
 * Admin-only migration tool to initialize InventoryQuantity from a physical stocktake.
 * One-time execution, prevents accidental re-runs.
 * 
 * Payload:
 * {
 *   seedData: [
 *     {
 *       price_list_item_id: string,
 *       item_name: string,
 *       locations: [
 *         { location_id: string, location_name: string, current: number, counted: number },
 *         ...
 *       ]
 *     },
 *     ...
 *   ],
 *   allowRerun: boolean (optional, default false),
 *   overrideReason: string (required if allowRerun=true)
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only enforcement
    if (!user || user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden: Admin access required'
      }, { status: 403 });
    }

    const { seedData, allowRerun = false, overrideReason } = await req.json();

    if (!seedData || !Array.isArray(seedData) || seedData.length === 0) {
      return Response.json({
        error: 'seedData array required and must not be empty'
      }, { status: 400 });
    }

    // Check if baseline seed has already been executed
    const existingRuns = await base44.asServiceRole.entities.BaselineSeedRun.list();
    if (existingRuns.length > 0 && !allowRerun) {
      return Response.json({
        error: 'Baseline seed already executed',
        lastRun: existingRuns[existingRuns.length - 1]
      }, { status: 400 });
    }

    if (existingRuns.length > 0 && allowRerun && !overrideReason) {
      return Response.json({
        error: 'Override reason required for re-run'
      }, { status: 400 });
    }

    const seedBatchId = uuidv4();
    const now = new Date().toISOString();
    let totalQtySeeded = 0;
    let totalLocationQtys = 0;
    let changesCount = 0;

    // Flatten all SKU×location pairs for batch processing
    const allPairs = [];
    for (const skuEntry of seedData) {
      if (!skuEntry.price_list_item_id || !skuEntry.locations) continue;
      for (const locEntry of skuEntry.locations) {
        if (!locEntry.location_id) continue;
        allPairs.push({ skuEntry, locEntry });
      }
    }

    // Process in batches of 50 to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < allPairs.length; i += batchSize) {
      const batch = allPairs.slice(i, i + batchSize);

      // Parallel: Fetch all existing InventoryQuantity records for this batch
      const existingPromises = batch.map(({ skuEntry, locEntry }) =>
        base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: skuEntry.price_list_item_id,
          location_id: locEntry.location_id
        })
      );
      const existingResults = await Promise.all(existingPromises);

      // Prepare upsert and movement operations
      const upsertOps = [];
      const movementOps = [];

      batch.forEach(({ skuEntry, locEntry }, idx) => {
        const current = locEntry.current || 0;
        const counted = locEntry.counted || 0;
        const delta = counted - current;
        const existing = existingResults[idx];

        if (existing.length > 0) {
          upsertOps.push(
            base44.asServiceRole.entities.InventoryQuantity.update(existing[0].id, {
              quantity: counted
            })
          );
        } else {
          upsertOps.push(
            base44.asServiceRole.entities.InventoryQuantity.create({
              price_list_item_id: skuEntry.price_list_item_id,
              location_id: locEntry.location_id,
              quantity: counted,
              item_name: skuEntry.item_name,
              location_name: locEntry.location_name
            })
          );
        }

        if (delta !== 0) {
          movementOps.push(
            base44.asServiceRole.entities.StockMovement.create({
              job_id: seedBatchId,
              sku_id: skuEntry.price_list_item_id,
              item_name: skuEntry.item_name,
              quantity: delta,
              from_location_id: delta < 0 ? locEntry.location_id : null,
              to_location_id: delta > 0 ? locEntry.location_id : null,
              to_location_name: delta > 0 ? locEntry.location_name : null,
              from_location_name: delta < 0 ? locEntry.location_name : null,
              performed_by_user_id: user.id,
              performed_by_user_email: user.email,
              performed_by_user_name: user.full_name || user.display_name,
              performed_at: now,
              source: 'baseline_seed',
              notes: `Baseline stocktake seed (set exact: ${current} → ${counted})`
            })
          );
        }

        totalQtySeeded += counted;
        totalLocationQtys++;
      });

      // Execute all batch operations in parallel
      await Promise.all([...upsertOps, ...movementOps]);
      changesCount += movementOps.length;
    }

    // 3. Record the baseline seed run
    const seedRun = await base44.asServiceRole.entities.BaselineSeedRun.create({
      seed_batch_id: seedBatchId,
      executed_at: now,
      executed_by_email: user.email,
      executed_by_name: user.full_name || user.display_name,
      skus_seeded: seedData,
      total_locations: totalLocationQtys,
      total_skus: seedData.length,
      notes: `System baseline stock migration${overrideReason ? ` (Override: ${overrideReason})` : ''}`
    });

    return Response.json({
      success: true,
      seedBatchId,
      message: 'Baseline stock seeded successfully',
      summary: {
        totalQtySeeded,
        totalLocationQtys,
        totalSkus: seedData.length,
        changesApplied: changesCount,
        executedAt: now,
        executedBy: user.full_name || user.display_name
      }
    });

  } catch (error) {
    console.error('[seedBaselineStock] Error:', error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});