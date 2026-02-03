import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { stop_confirmation_id } = body;

    if (!stop_confirmation_id) {
      return Response.json({ 
        success: false, 
        error: 'stop_confirmation_id is required' 
      }, { status: 400 });
    }

    // Fetch the confirmation
    const confirmation = await base44.asServiceRole.entities.StopConfirmation.get(stop_confirmation_id);
    if (!confirmation) {
      return Response.json({ success: false, error: 'Confirmation not found' }, { status: 404 });
    }

    // Fetch the stop
    const stop = await base44.asServiceRole.entities.LogisticsStop.get(confirmation.stop_id);
    if (!stop) {
      return Response.json({ success: false, error: 'Stop not found' }, { status: 404 });
    }

    const runId = stop.run_id;
    if (!runId) {
      return Response.json({ success: false, error: 'Stop has no run_id' }, { status: 400 });
    }

    // Fetch all stops for this run
    const allStops = await base44.asServiceRole.entities.LogisticsStop.filter({ run_id: runId });
    const totalStops = allStops.length;

    // Fetch all confirmations for this run's stops
    const stopIds = allStops.map(s => s.id);
    const allConfirmations = await base44.asServiceRole.entities.StopConfirmation.list();
    const runConfirmations = allConfirmations.filter(c => stopIds.includes(c.stop_id));
    const completedCount = runConfirmations.length;

    console.log(`[completeStopAndUpdateRun] Run ${runId}: ${completedCount}/${totalStops} stops completed`);

    // Fetch the run
    const run = await base44.asServiceRole.entities.LogisticsRun.get(runId);
    if (!run) {
      return Response.json({ success: false, error: 'Run not found' }, { status: 404 });
    }

    let runUpdates = {};
    let statusChanged = false;

    // If all stops completed → mark run as completed
    if (completedCount === totalStops && run.status !== 'completed') {
      runUpdates.status = 'completed';
      runUpdates.completed_at = new Date().toISOString();
      statusChanged = true;
      console.log(`[completeStopAndUpdateRun] All stops completed → marking run ${runId} as completed`);
    } 
    // If some completed and run is draft → mark as in_progress
    else if (completedCount > 0 && run.status === 'draft') {
      runUpdates.status = 'in_progress';
      statusChanged = true;
      console.log(`[completeStopAndUpdateRun] First stop completed → marking run ${runId} as in_progress`);
    }

    // Update run if needed
    if (Object.keys(runUpdates).length > 0) {
      await base44.asServiceRole.entities.LogisticsRun.update(runId, runUpdates);
    }

    // Propagate status to linked records
    if (statusChanged) {
      const finalStatus = runUpdates.status || run.status;
      
      // Update receipts linked to this run
      const receipts = await base44.asServiceRole.entities.Receipt.filter({ clear_run_id: runId });
      for (const receipt of receipts) {
        if (finalStatus === 'completed' && receipt.status === 'open') {
          await base44.asServiceRole.entities.Receipt.update(receipt.id, {
            status: 'cleared',
            cleared_at: new Date().toISOString(),
            cleared_by_name: user.full_name || user.email
          });
          console.log(`[completeStopAndUpdateRun] Marked receipt ${receipt.id} as cleared`);
        }
      }

      // Update allocations linked to this run
      const allocations = await base44.asServiceRole.entities.StockAllocation.filter({ logistics_run_id: runId });
      for (const alloc of allocations) {
        await base44.asServiceRole.entities.StockAllocation.update(alloc.id, {
          logistics_run_status: finalStatus
        });
        console.log(`[completeStopAndUpdateRun] Updated allocation ${alloc.id} status to ${finalStatus}`);
      }
    }

    return Response.json({
      success: true,
      run_id: runId,
      completed_count: completedCount,
      total_stops: totalStops,
      run_status: runUpdates.status || run.status,
      status_changed: statusChanged
    });

  } catch (error) {
    console.error('[completeStopAndUpdateRun] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});