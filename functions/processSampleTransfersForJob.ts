import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Explicit Sample Transfer Handler
 * 
 * Processes sample transfers for a logistics job ONLY on explicit completion.
 * Ensures idempotency: never double-transfers samples.
 * Uses manageSample for all mutations to maintain audit trail.
 * 
 * NEW MODEL:
 * - sample_dropoff: storage/vehicle → project/client (on completion)
 * - sample_pickup: project/client → storage OR vehicle (on completion, per sample_outcome)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // IDEMPOTENCY: If already completed, skip
    if (job.samples_transfer_status === 'completed') {
      console.log(`[processSampleTransfersForJob] Job ${job_id} already completed - skipping`);
      return Response.json({
        success: true,
        processed_count: 0,
        skipped_reason: 'already_completed',
        message: 'Samples already transferred for this job'
      });
    }

    if (!job.sample_ids || job.sample_ids.length === 0) {
      return Response.json({
        success: true,
        processed_count: 0,
        skipped_reason: 'no_samples',
        message: 'Job has no samples'
      });
    }

    const logisticsPurpose = job.logistics_purpose || '';
    let processedCount = 0;

    // SAMPLE_DROPOFF: storage/vehicle → project/client
    if (logisticsPurpose === 'sample_dropoff') {
      if (!job.project_id) {
        return Response.json({
          error: 'sample_dropoff requires project_id',
          code: 'MISSING_PROJECT_ID'
        }, { status: 400 });
      }

      for (const sample_id of job.sample_ids) {
        try {
          await base44.asServiceRole.functions.invoke('manageSample', {
            action: 'checkoutToProject',
            sample_id,
            project_id: job.project_id,
            due_back_at: null,
            notes: `Checked out via sample_dropoff job #${job.job_number}`
          });
          processedCount++;
        } catch (error) {
          console.error(`[processSampleTransfersForJob] Error checking out sample ${sample_id}:`, error);
          throw error;
        }
      }
    }
    // SAMPLE_PICKUP: project/client → storage OR vehicle
    else if (logisticsPurpose === 'sample_pickup') {
      const outcome = job.sample_outcome || 'return_to_storage';

      for (const sample_id of job.sample_ids) {
        try {
          if (outcome === 'move_to_vehicle') {
            // Move to vehicle
            if (!job.vehicle_id) {
              throw new Error('sample_outcome=move_to_vehicle requires vehicle_id');
            }
            await base44.asServiceRole.functions.invoke('manageSample', {
              action: 'transferToVehicle',
              sample_id,
              vehicle_id: job.vehicle_id,
              notes: `Moved to vehicle via sample_pickup job #${job.job_number}`
            });
          } else {
            // Default: return_to_storage
            await base44.asServiceRole.functions.invoke('manageSample', {
              action: 'returnToStorage',
              sample_id,
              notes: `Returned to storage via sample_pickup job #${job.job_number}`
            });
          }
          processedCount++;
        } catch (error) {
          console.error(`[processSampleTransfersForJob] Error processing sample ${sample_id}:`, error);
          throw error;
        }
      }
    } else {
      // Not a sample logistics job
      return Response.json({
        success: true,
        processed_count: 0,
        skipped_reason: 'not_sample_job',
        message: `Job purpose '${logisticsPurpose}' is not a sample logistics job`
      });
    }

    // IDEMPOTENCY: Mark as completed
    await base44.asServiceRole.entities.Job.update(job_id, {
      samples_transfer_status: 'completed',
      samples_processed_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      processed_count: processedCount,
      job_id,
      logistics_purpose: logisticsPurpose,
      message: `Processed ${processedCount} sample(s) for job #${job.job_number}`
    });
  } catch (error) {
    console.error('[processSampleTransfersForJob] Error:', error);
    return Response.json({
      error: error.message || 'Internal server error',
      code: 'TRANSFER_FAILED'
    }, { status: 500 });
  }
});