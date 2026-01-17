import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { v4 as uuidv4 } from 'npm:uuid@9.0.0';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRateLimitError = (err) => {
  const msg = String(err && err.message ? err.message : err || '').toLowerCase();
  return (msg.includes('rate') && msg.includes('limit')) || msg.includes('429');
};

const withRetry = async (fn, opts) => {
  const maxRetries = (opts && opts.maxRetries) ?? 8;
  const baseDelayMs = (opts && opts.baseDelayMs) ?? 250;
  const jitterMs = (opts && opts.jitterMs) ?? 150;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (!isRateLimitError(err) || attempt > maxRetries) throw err;
      const delay =
        baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * jitterMs);
      await sleep(delay);
    }
  }
};

/**
 * BASELINE STOCK SEED FUNCTION (rate-limit safe)
 *
 * Strategy:
 * 1) Load all InventoryQuantity once, build map (sku|loc -> record)
 * 2) Flatten seed pairs, skip no-ops
 * 3) Upsert with retry/backoff + small pacing
 * 4) Write StockMovement only when delta != 0
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const seedData = body.seedData;
    const allowRerun = Boolean(body.allowRerun);
    const overrideReason = body.overrideReason;

    if (!seedData || !Array.isArray(seedData) || seedData.length === 0) {
      return Response.json({ error: 'seedData array required and must not be empty' }, { status: 400 });
    }

    // Guard: baseline already run?
    const existingRuns = await withRetry(() =>
      base44.asServiceRole.entities.BaselineSeedRun.list()
    );

    if (existingRuns.length > 0 && !allowRerun) {
      return Response.json(
        { error: 'Baseline seed already executed', lastRun: existingRuns[existingRuns.length - 1] },
        { status: 400 }
      );
    }
    if (existingRuns.length > 0 && allowRerun && !String(overrideReason || '').trim()) {
      return Response.json({ error: 'Override reason required for re-run' }, { status: 400 });
    }

    const seedBatchId = uuidv4();
    const now = new Date().toISOString();

    // 1) Load ALL current InventoryQuantity ONCE (removes per-row filter() calls)
    const allIQ = await withRetry(() =>
      base44.asServiceRole.entities.InventoryQuantity.list()
    );

    // Map key => { id, quantity }
    const iqMap = new Map();
    for (const iq of allIQ || []) {
      const skuId = iq.price_list_item_id;
      const locId = iq.location_id;
      if (!skuId || !locId) continue;
      const qty = Number(iq.quantity ?? iq.qty ?? 0);
      iqMap.set(`${skuId}__${locId}`, { id: iq.id, quantity: Number.isFinite(qty) ? qty : 0 });
    }

    // 2) Flatten seed rows and SKIP no-ops early
    const pairs = [];

    for (const skuEntry of seedData) {
      if (!skuEntry || !skuEntry.price_list_item_id || !Array.isArray(skuEntry.locations)) continue;

      for (const locEntry of skuEntry.locations) {
        if (!locEntry || !locEntry.location_id) continue;

        const current = Number(locEntry.current ?? 0);
        const counted = Number(locEntry.counted ?? 0);
        if (!Number.isFinite(current) || !Number.isFinite(counted) || counted < 0) continue;

        const delta = counted - current;
        if (delta === 0) continue;

        pairs.push({
          sku_id: skuEntry.price_list_item_id,
          item_name: skuEntry.item_name || 'Unknown',
          location_id: locEntry.location_id,
          location_name: locEntry.location_name || 'Unknown',
          current,
          counted,
          delta
        });
      }
    }

    if (pairs.length === 0) {
      return Response.json({
        success: true,
        seedBatchId,
        message: 'No changes detected (all counted == current). Nothing to seed.',
        summary: { changesApplied: 0, executedAt: now, executedBy: user.full_name || user.display_name }
      });
    }

    // 3) Process pairs with pacing + retry/backoff
    const OP_PAUSE_MS = 50;   // tune upward if still rate-limiting (75-120ms)
    const BATCH_PAUSE_MS = 300;
    const batchSize = 20;

    let changesCount = 0;
    let inventoryWrites = 0;

    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);

      for (const p of batch) {
        const key = `${p.sku_id}__${p.location_id}`;
        const existing = iqMap.get(key);

        // Upsert InventoryQuantity to EXACT counted value
        if (existing && existing.id) {
          await withRetry(() =>
            base44.asServiceRole.entities.InventoryQuantity.update(existing.id, {
              quantity: p.counted
            })
          );
        } else {
          const created = await withRetry(() =>
            base44.asServiceRole.entities.InventoryQuantity.create({
              price_list_item_id: p.sku_id,
              location_id: p.location_id,
              quantity: p.counted,
              item_name: p.item_name,
              location_name: p.location_name
            })
          );
          if (created && created.id) iqMap.set(key, { id: created.id, quantity: p.counted });
        }
        inventoryWrites++;

        // Create StockMovement ONLY when delta != 0
        await withRetry(() =>
          base44.asServiceRole.entities.StockMovement.create({
            job_id: seedBatchId,
            sku_id: p.sku_id,
            item_name: p.item_name,
            quantity: p.delta,
            from_location_id: p.delta < 0 ? p.location_id : null,
            to_location_id: p.delta > 0 ? p.location_id : null,
            to_location_name: p.delta > 0 ? p.location_name : null,
            from_location_name: p.delta < 0 ? p.location_name : null,
            performed_by_user_id: user.id,
            performed_by_user_email: user.email,
            performed_by_user_name: user.full_name || user.display_name,
            performed_at: now,
            source: 'baseline_seed',
            reference_type: 'system_migration',
            reference_id: seedBatchId,
            notes: `Baseline seed (set exact: ${p.current} → ${p.counted})${overrideReason ? ` | Override: ${overrideReason}` : ''}`
          })
        );

        changesCount++;
        await sleep(OP_PAUSE_MS);
      }

      await sleep(BATCH_PAUSE_MS);
    }

    // 4) Record baseline seed run
    await withRetry(() =>
      base44.asServiceRole.entities.BaselineSeedRun.create({
        seed_batch_id: seedBatchId,
        executed_at: now,
        executed_by_email: user.email,
        executed_by_name: user.full_name || user.display_name,
        total_locations: pairs.length,
        total_skus: seedData.length,
        notes: `System baseline stock migration${overrideReason ? ` (Override: ${overrideReason})` : ''}`
      })
    );

    return Response.json({
      success: true,
      seedBatchId,
      message: 'Baseline stock seeded successfully',
      summary: {
        inventoryWrites,
        changesApplied: changesCount,
        executedAt: now,
        executedBy: user.full_name || user.display_name
      }
    });
  } catch (error) {
    console.error('[seedBaselineStock] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
