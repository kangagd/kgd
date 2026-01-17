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
 *       location_id: string,
 *       location_name: string,
 *       current: number,
 *       counted: number
 *     },
 *     ...
 *   ],
 *   allowRerun: boolean (optional, default false),
 *   overrideReason: string (required if allowRerun=true)
 * }
 * 
 * CRITICAL: seedData contains only CHANGED entries (current !== counted)
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

    // Validate no negative counted values
    for (const entry of seedData) {
      if (entry.counted < 0) {
        return Response.json({
          error: `Negative count not allowed for ${entry.item_name} at ${entry.location_name}`
        }, { status: 400 });
      }
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
    let changesCount = 0;

    // Process each change entry
    for (const entry of seedData) {
      if (!entry.price_list_item_id || !entry.location_id) continue;

      const current = entry.current || 0;
      const counted = entry.counted || 0;
      const delta = counted - current;

      // 1. Upsert InventoryQuantity to EXACT counted value
      const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id: entry.price_list_item_id,
        location_id: entry.location_id
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.InventoryQuantity.update(existing[0].id, {
          quantity: counted
        });
      } else {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id: entry.price_list_item_id,
          location_id: entry.location_id,
          quantity: counted,
          item_name: entry.item_name,
          location_name: entry.location_name
        });
      }

      // 2. Create StockMovement with delta (only created because current !== counted)
      await base44.asServiceRole.entities.StockMovement.create({
        sku_id: entry.price_list_item_id,
        item_name: entry.item_name,
        quantity: delta,  // qty represents the delta applied
        from_location_id: null,
        to_location_id: entry.location_id,
        to_location_name: entry.location_name,
        performed_by_user_id: user.id,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name,
        performed_at: now,
        source: 'baseline_seed',
        reference_type: 'system_migration',
        reference_id: seedBatchId,
        notes: `Baseline stocktake seed (set exact: ${current} → ${counted})`
      });
      changesCount++;
    }

    // 3. Record the baseline seed run
    await base44.asServiceRole.entities.BaselineSeedRun.create({
      seed_batch_id: seedBatchId,
      executed_at: now,
      executed_by_email: user.email,
      executed_by_name: user.full_name || user.display_name,
      skus_seeded: seedData.map(entry => ({
        price_list_item_id: entry.price_list_item_id,
        item_name: entry.item_name,
        locations: [{
          location_id: entry.location_id,
          location_name: entry.location_name,
          quantity: entry.counted
        }]
      })),
      total_locations: seedData.length,
      total_skus: new Set(seedData.map(e => e.price_list_item_id)).size,
      notes: `System baseline stock migration${overrideReason ? ` (Override: ${overrideReason})` : ''}`
    });

    return Response.json({
      success: true,
      seedBatchId,
      message: 'Baseline stock seeded successfully',
      summary: {
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