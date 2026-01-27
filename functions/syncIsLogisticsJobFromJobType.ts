import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all logistics job types
    const logisticsJobTypes = await base44.entities.JobType.filter({ is_logistics: true });
    const logisticsJobTypeIds = logisticsJobTypes.map(jt => jt.id);

    if (logisticsJobTypeIds.length === 0) {
      return Response.json({ success: true, updated: 0, message: 'No logistics job types found' });
    }

    // Fetch all jobs with logistics job types but is_logistics_job: false
    const jobsToUpdate = await base44.entities.Job.filter({
      job_type_id: { $in: logisticsJobTypeIds },
      is_logistics_job: false
    });

    if (jobsToUpdate.length === 0) {
      return Response.json({ success: true, updated: 0, message: 'All logistics jobs already marked correctly' });
    }

    // Update all these jobs
    let updated = 0;
    for (const job of jobsToUpdate) {
      await base44.entities.Job.update(job.id, { is_logistics_job: true });
      updated++;
    }

    return Response.json({
      success: true,
      updated,
      message: `Updated ${updated} jobs to mark them as logistics jobs`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});