import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * S5.0 - Get-or-Create Logistics Run (Idempotent)
 * 
 * Prevents duplicate run creation by using intent_key.
 * If a run with the same intent_key exists (and not cancelled), returns it.
 * Otherwise, creates a new run with stops.
 */

const DEBUG_LOGISTICS_V2 = true;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { intent_key, intent_kind, runDraftData = {}, stopsDraftData = [], intent_meta_json } = await req.json();

    if (!intent_key || !intent_kind) {
      return Response.json({ error: 'intent_key and intent_kind are required' }, { status: 400 });
    }

    if (DEBUG_LOGISTICS_V2) {
      console.log(`[getOrCreateLogisticsRun] Intent: ${intent_key}`);
    }

    // Check if run already exists with this intent_key (exclude cancelled/deleted)
    const existingRuns = await base44.asServiceRole.entities.LogisticsRun.filter({
      intent_key,
      status: { $ne: 'cancelled' },
      deleted_at: { $exists: false }
    });

    if (existingRuns.length > 0) {
      const existingRun = existingRuns[0];
      if (DEBUG_LOGISTICS_V2) {
        console.log(`[getOrCreateLogisticsRun] Reusing existing run: ${existingRun.id}`);
      }
      return Response.json({ 
        run: existingRun, 
        reused: true,
        message: 'Run already exists with this intent'
      });
    }

    // Create new run
    const newRun = await base44.asServiceRole.entities.LogisticsRun.create({
      intent_key,
      intent_kind,
      intent_meta_json: intent_meta_json || null,
      status: 'draft',
      ...runDraftData
    });

    if (DEBUG_LOGISTICS_V2) {
      console.log(`[getOrCreateLogisticsRun] Created new run: ${newRun.id}`);
    }

    // Create stops
    const createdStops = [];
    for (let i = 0; i < stopsDraftData.length; i++) {
      const stopData = stopsDraftData[i];
      const stop = await base44.asServiceRole.entities.LogisticsStop.create({
        run_id: newRun.id,
        sequence: i + 1,
        ...stopData
      });
      createdStops.push(stop);
    }

    if (DEBUG_LOGISTICS_V2) {
      console.log(`[getOrCreateLogisticsRun] Created ${createdStops.length} stops`);
    }

    return Response.json({ 
      run: newRun, 
      stops: createdStops,
      reused: false,
      message: 'New run created'
    });

  } catch (error) {
    console.error('[getOrCreateLogisticsRun] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});