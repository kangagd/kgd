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
 *         { location_id: string, location_name: string, quantity: number },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
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

    const { seedData, allowRerun = false } = await req.json();

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

    const seedBatchId = uuidv4();
    const now = new Date().toISOString();
    let totalQtySeeded = 0;
    let totalLocationQtys = 0;

    // Process each SKU and location
    for (const skuEntry of seedData) {
      if (!skuEntry.price_list_item_id || !skuEntry.locations) continue;

      for (const locEntry of skuEntry.locations) {
        if (!locEntry.location_id || (locEntry.quantity === null && locEntry.quantity === undefined)) continue;

        const qty = Math.max(0, locEntry.quantity);
        if (qty === 0) continue;

        // 1. Upsert InventoryQuantity
        const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: skuEntry.price_list_item_id,
          location_id: locEntry.location_id
        });

        if (existing.length > 0) {
          // Update existing record
          await base44.asServiceRole.entities.InventoryQuantity.update(existing[0].id, {
            quantity: qty
          });
        } else {
          // Create new record
          await base44.asServiceRole.entities.InventoryQuantity.create({
            price_list_item_id: skuEntry.price_list_item_id,
            location_id: locEntry.location_id,
            quantity: qty,
            item_name: skuEntry.item_name,
            location_name: locEntry.location_name
          });
        }

        // 2. Create StockMovement audit record
        await base44.asServiceRole.entities.StockMovement.create({
          sku_id: skuEntry.price_list_item_id,
          item_name: skuEntry.item_name,
          quantity: qty,
          from_location_id: null,
          to_location_id: locEntry.location_id,
          to_location_name: locEntry.location_name,
          performed_by_user_id: user.id,
          performed_by_user_email: user.email,
          performed_by_user_name: user.full_name || user.display_name,
          performed_at: now,
          source: 'baseline_seed',
          reference_type: 'system_migration',
          reference_id: seedBatchId,
          notes: 'Baseline stocktake seed'
        });

        totalQtySeeded += qty;
        totalLocationQtys++;
      }
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
      notes: 'System baseline stock migration'
    });

    return Response.json({
      success: true,
      seedBatchId,
      message: 'Baseline stock seeded successfully',
      summary: {
        totalQtySeeded,
        totalLocationQtys,
        totalSkus: seedData.length,
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