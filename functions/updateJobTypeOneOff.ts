import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { job_number, job_type_name } = await req.json();

    // Find job by number
    const jobs = await base44.asServiceRole.entities.Job.filter({
      job_number: job_number
    });

    if (jobs.length === 0) {
      return Response.json({ error: `Job ${job_number} not found` }, { status: 404 });
    }

    const job = jobs[0];

    // Find JobType
    const jobTypes = await base44.asServiceRole.entities.JobType.filter({
      name: job_type_name
    });

    if (jobTypes.length === 0) {
      return Response.json({ error: `JobType "${job_type_name}" not found` }, { status: 404 });
    }

    const jobType = jobTypes[0];

    // Update job
    await base44.asServiceRole.entities.Job.update(job.id, {
      job_type_id: jobType.id,
      job_type: jobType.name,
      job_type_name: jobType.name
    });

    return Response.json({
      success: true,
      job_id: job.id,
      job_number: job_number,
      job_type_id: jobType.id,
      job_type_name: jobType.name,
      message: `Updated job ${job_number} to ${jobType.name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});