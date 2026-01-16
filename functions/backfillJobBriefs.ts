import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { limit = 100 } = await req.json();

    // Fetch jobs with project_id and no brief
    const jobs = await base44.asServiceRole.entities.Job.filter({
      project_id: { $ne: null }
    });

    const jobsToProcess = jobs
      .filter(job => !job.job_brief || !job.job_brief.trim())
      .slice(0, limit);

    const results = [];
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const job of jobsToProcess) {
      try {
        const response = await base44.asServiceRole.functions.invoke('generateJobBrief', {
          job_id: job.id,
          mode: 'auto'
        });

        if (response.data.success && !response.data.skipped) {
          generated++;
          results.push({
            job_id: job.id,
            job_number: job.job_number,
            status: 'generated'
          });
        } else {
          skipped++;
        }
      } catch (err) {
        errors++;
        console.error(`Error backfilling job ${job.id}:`, err);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      total_processed: jobsToProcess.length,
      generated,
      skipped,
      errors,
      results: results.slice(0, 10) // Return first 10 for reference
    });
  } catch (error) {
    console.error('Error backfilling job briefs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});