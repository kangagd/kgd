import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sample Flow Checkpoint
 * 
 * Validates sample integrity under the NEW explicit-action model:
 * - Samples are ONLY moved on job completion
 * - sample_dropoff: creation = no change, completion = checkout to project
 * - sample_pickup: creation = no change, completion = move per sample_outcome
 * 
 * Returns integrity report with counts, warnings, and mismatches.
 */

async function runCheckpoint(base44) {
  console.log('[sampleFlowCheckpoint] Starting...');
  
  const report = {
    timestamp: new Date().toISOString(),
    counts: {
      samples_total: 0,
      sample_movements_total: 0,
      sample_logistics_jobs: 0,
      sample_dropoff_jobs: 0,
      sample_pickup_jobs: 0
    },
    integrity_issues: [],
    warnings: []
  };

  try {
    // === COUNT TOTALS ===
    console.log('[sampleFlowCheckpoint] Fetching counts...');
    const samples = await base44.asServiceRole.entities.Sample.list();
    report.counts.samples_total = samples.length;

    const movements = await base44.asServiceRole.entities.SampleMovement.list();
    report.counts.sample_movements_total = movements.length;

    const jobs = await base44.asServiceRole.entities.Job.filter({
      is_logistics_job: true,
      deleted_at: null
    });

    const sampleJobs = jobs.filter(j => j.logistics_purpose && ['sample_dropoff', 'sample_pickup'].includes(j.logistics_purpose));
    report.counts.sample_logistics_jobs = sampleJobs.length;
    report.counts.sample_dropoff_jobs = sampleJobs.filter(j => j.logistics_purpose === 'sample_dropoff').length;
    report.counts.sample_pickup_jobs = sampleJobs.filter(j => j.logistics_purpose === 'sample_pickup').length;

    // === INTEGRITY CHECKS ===
    console.log('[sampleFlowCheckpoint] Running integrity checks...');

    // 1. Samples with invalid current_location_type
    for (const sample of samples) {
      if (sample.current_location_type && !sample.current_location_reference_id) {
        report.integrity_issues.push({
          type: 'missing_location_ref',
          sample_id: sample.id,
          sample_name: sample.name,
          current_location_type: sample.current_location_type,
          issue: `Sample has current_location_type='${sample.current_location_type}' but missing reference_id`
        });
      }

      // 2. Samples checked out but location inconsistent
      if (sample.checked_out_project_id && sample.current_location_type !== 'project') {
        report.integrity_issues.push({
          type: 'location_mismatch',
          sample_id: sample.id,
          sample_name: sample.name,
          checked_out_project_id: sample.checked_out_project_id,
          current_location_type: sample.current_location_type,
          issue: `Sample checked out to project but current_location_type='${sample.current_location_type}'`
        });
      }
    }

    // 3. Check sample_dropoff jobs: if Completed, should have samples checked out
    for (const job of sampleJobs.filter(j => j.logistics_purpose === 'sample_dropoff')) {
      if (job.status === 'Completed') {
        // Should be marked as processed
        if (job.samples_transfer_status !== 'completed') {
          report.warnings.push({
            type: 'dropoff_not_processed',
            job_id: job.id,
            job_number: job.job_number,
            sample_count: job.sample_ids?.length || 0,
            warning: `sample_dropoff job is Completed but samples_transfer_status='${job.samples_transfer_status}' (expected 'completed')`
          });
        }

        // Verify samples are actually checked out
        const jobSamples = job.sample_ids || [];
        for (const sample_id of jobSamples) {
          const sample = samples.find(s => s.id === sample_id);
          if (sample && sample.checked_out_project_id !== job.project_id) {
            report.warnings.push({
              type: 'sample_not_checked_out',
              job_id: job.id,
              sample_id,
              sample_name: sample.name,
              expected_project_id: job.project_id,
              actual_checked_out_project_id: sample.checked_out_project_id,
              warning: `Sample not checked out to correct project for dropoff job`
            });
          }
        }
      }
    }

    // 4. Check sample_pickup jobs: if Completed, should have samples moved
    for (const job of sampleJobs.filter(j => j.logistics_purpose === 'sample_pickup')) {
      if (job.status === 'Completed') {
        // Should be marked as processed
        if (job.samples_transfer_status !== 'completed') {
          report.warnings.push({
            type: 'pickup_not_processed',
            job_id: job.id,
            job_number: job.job_number,
            sample_count: job.sample_ids?.length || 0,
            sample_outcome: job.sample_outcome,
            warning: `sample_pickup job is Completed but samples_transfer_status='${job.samples_transfer_status}' (expected 'completed')`
          });
        }

        // Verify samples are in expected location
        const outcome = job.sample_outcome || 'return_to_storage';
        const jobSamples = job.sample_ids || [];
        for (const sample_id of jobSamples) {
          const sample = samples.find(s => s.id === sample_id);
          if (sample) {
            const expectedLocation = outcome === 'move_to_vehicle' ? 'vehicle' : 'storage';
            const actualLocation = sample.current_location_type;
            
            if (expectedLocation === 'vehicle' && actualLocation !== 'vehicle') {
              report.warnings.push({
                type: 'sample_wrong_location',
                job_id: job.id,
                sample_id,
                sample_name: sample.name,
                expected: 'vehicle',
                actual: actualLocation,
                warning: `Pickup job outcome='move_to_vehicle' but sample in '${actualLocation}'`
              });
            } else if (expectedLocation === 'storage' && actualLocation !== 'storage') {
              report.warnings.push({
                type: 'sample_wrong_location',
                job_id: job.id,
                sample_id,
                sample_name: sample.name,
                expected: 'storage',
                actual: actualLocation,
                warning: `Pickup job outcome='return_to_storage' but sample in '${actualLocation}'`
              });
            }
          }
        }
      }
    }

    // 5. Check for orphaned sample movements (no corresponding job)
    const jobIds = new Set(sampleJobs.map(j => j.id));
    const orphanedMovements = movements.filter(m => m.job_id && !jobIds.has(m.job_id));
    if (orphanedMovements.length > 0) {
      report.warnings.push({
        type: 'orphaned_movements',
        count: orphanedMovements.length,
        warning: `${orphanedMovements.length} SampleMovement(s) reference non-existent jobs`
      });
    }

    console.log('[sampleFlowCheckpoint] Checkpoint complete');
    return report;
  } catch (error) {
    console.error('[sampleFlowCheckpoint] Error:', error);
    return {
      ...report,
      error: error.message,
      status: 'failed'
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const report = await runCheckpoint(base44);
    
    return Response.json({
      success: true,
      checkpoint: report
    });
  } catch (error) {
    console.error('[sampleFlowCheckpoint] Handler error:', error);
    return Response.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});