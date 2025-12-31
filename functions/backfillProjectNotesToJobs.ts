import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all jobs with project_id
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const jobsWithProjects = allJobs.filter(job => job.project_id);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const job of jobsWithProjects) {
      try {
        // Fetch the associated project
        const project = await base44.asServiceRole.entities.Project.get(job.project_id);
        
        // Only update if project has notes and job doesn't already have notes
        if (project.notes && !job.notes) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            notes: project.notes
          });
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errors.push({
          job_id: job.id,
          job_number: job.job_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_jobs_checked: jobsWithProjects.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});