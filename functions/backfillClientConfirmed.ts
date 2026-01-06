import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Get tomorrow's date (midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch all jobs with scheduled_date before tomorrow
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const pastJobs = allJobs.filter(job => {
      if (!job.scheduled_date) return false;
      const scheduledDate = new Date(job.scheduled_date);
      return scheduledDate < tomorrow;
    });

    console.log(`Found ${pastJobs.length} past jobs to update`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const job of pastJobs) {
      try {
        // Skip if already confirmed
        if (job.client_confirmed) {
          skippedCount++;
          continue;
        }

        await base44.asServiceRole.entities.Job.update(job.id, {
          client_confirmed: true,
          client_confirmed_at: new Date().toISOString()
        });
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update job ${job.id}:`, err);
        errors.push({ job_id: job.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      total_past_jobs: pastJobs.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in backfillClientConfirmed:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});