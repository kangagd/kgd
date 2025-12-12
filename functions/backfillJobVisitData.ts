import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all completed jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      status: 'Completed',
      deleted_at: { $exists: false }
    });

    let updatedCount = 0;
    let skippedCount = 0;

    for (const job of jobs) {
      // Check if job already has visit data
      const hasData = job.overview || job.next_steps || job.communication_with_client;
      
      if (hasData) {
        skippedCount++;
        continue;
      }

      // Find most recent JobSummary for this job
      const summaries = await base44.asServiceRole.entities.JobSummary.filter(
        { job_id: job.id },
        '-check_out_time',
        1
      );

      if (summaries.length === 0) {
        skippedCount++;
        continue;
      }

      const summary = summaries[0];

      // Update job with data from summary
      await base44.asServiceRole.entities.Job.update(job.id, {
        overview: summary.overview || "",
        next_steps: summary.next_steps || "",
        communication_with_client: summary.communication_with_client || "",
        outcome: summary.outcome || ""
      });

      updatedCount++;
    }

    return Response.json({
      success: true,
      total_jobs: jobs.length,
      updated: updatedCount,
      skipped: skippedCount
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});