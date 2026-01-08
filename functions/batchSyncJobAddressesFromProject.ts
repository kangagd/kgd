import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Batch sync job addresses from their parent projects
// Admin-only scheduled task or manual run
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse options
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? body.dryRun ?? true;
    const limit = body.limit || null;

    console.log(`[batchSyncJobAddresses] Starting sync - dry_run: ${dryRun}, limit: ${limit}`);

    // Fetch all jobs with project_id
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      project_id: { $ne: null },
      deleted_at: null
    });

    const jobsToProcess = limit ? allJobs.slice(0, limit) : allJobs;

    const results = {
      total: jobsToProcess.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    // Build project map
    const projectIds = [...new Set(jobsToProcess.map(j => j.project_id).filter(Boolean))];
    const projects = await base44.asServiceRole.entities.Project.filter({
      id: { $in: projectIds }
    });
    const projectMap = new Map(projects.map(p => [p.id, p]));

    for (const job of jobsToProcess) {
      try {
        const project = projectMap.get(job.project_id);
        
        if (!project) {
          results.skipped++;
          continue;
        }

        // Check if address fields need updating
        const needsUpdate = 
          job.address_full !== project.address_full ||
          job.address_street !== project.address_street ||
          job.address_suburb !== project.address_suburb ||
          job.address_state !== project.address_state ||
          job.address_postcode !== project.address_postcode ||
          job.address_country !== project.address_country ||
          job.google_place_id !== project.google_place_id ||
          job.latitude !== project.latitude ||
          job.longitude !== project.longitude;

        if (!needsUpdate) {
          results.skipped++;
          continue;
        }

        if (!dryRun) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            address_full: project.address_full,
            address_street: project.address_street,
            address_suburb: project.address_suburb,
            address_state: project.address_state,
            address_postcode: project.address_postcode,
            address_country: project.address_country,
            google_place_id: project.google_place_id,
            latitude: project.latitude,
            longitude: project.longitude
          });
        }

        results.synced++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          job_id: job.id,
          job_number: job.job_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      summary: `${dryRun ? 'Would sync' : 'Synced'} ${results.synced}/${results.total} jobs, ${results.skipped} unchanged, ${results.failed} failed`,
      details: results
    });

  } catch (error) {
    console.error('batchSyncJobAddressesFromProject error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});