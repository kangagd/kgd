import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dryRun = false } = await req.json();
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    const jobs = await base44.asServiceRole.entities.Job.list();

    for (const job of jobs) {
      results.processed++;
      let needsUpdate = false;
      const updates = {};

      // Migrate Legacy Job ID or Pipedrive ID
      if (job.legacy_id && !job.legacy_job_id) {
        updates.legacy_job_id = String(job.legacy_id);
        needsUpdate = true;
      }
      
      // Map old job types to new format if needed
      if (job.job_type === 'Installation' && !job.product) {
          updates.product = 'Garage Door'; // Default or logic
          needsUpdate = true;
      }

      // Normalize status
      const statusMap = {
          'scheduled': 'Scheduled',
          'open': 'Open',
          'completed': 'Completed',
          'cancelled': 'Cancelled'
      };
      if (statusMap[job.status] && statusMap[job.status] !== job.status) {
          updates.status = statusMap[job.status];
          needsUpdate = true;
      }

      // Ensure Project linkage
      if (job.project_id && !job.project_name) {
          try {
              const project = await base44.asServiceRole.entities.Project.get(job.project_id);
              if (project) {
                  updates.project_name = project.title;
                  updates.customer_id = project.customer_id; // Ensure consistency
                  needsUpdate = true;
              }
          } catch (e) {}
      }

      if (needsUpdate) {
        if (!dryRun) {
          try {
            await base44.asServiceRole.entities.Job.update(job.id, updates);
            results.updated++;
          } catch (e) {
            results.errors.push({ id: job.id, error: e.message });
          }
        } else {
          results.updated++;
        }
      } else {
        results.skipped++;
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Job migration complete',
      dryRun,
      stats: results 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});