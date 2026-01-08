import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      client_confirmed: false,
      status: 'Scheduled'
    });

    // Filter for jobs scheduled in the next 7 days, excluding logistics jobs
    const filtered = jobs.filter(job => {
      if (!job.scheduled_date || job.is_logistics_job) return false;
      const scheduledDate = new Date(job.scheduled_date);
      return scheduledDate >= new Date() && scheduledDate <= sevenDaysFromNow;
    });

    return Response.json({ jobs: filtered || [] });

  } catch (error) {
    console.error('[getUnconfirmedJobs] Error:', error);
    return Response.json({ 
      jobs: [], 
      error: 'Failed to fetch unconfirmed jobs' 
    }, { status: 200 });
  }
});