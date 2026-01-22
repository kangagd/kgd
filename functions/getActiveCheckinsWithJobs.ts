import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine effective role
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isManagerOrAdmin = isAdmin || isManager;

    // Fetch all active check-ins (no check_out_time)
    const checkIns = await base44.asServiceRole.entities.CheckInOut.list();
    const activeCheckIns = checkIns.filter(c => !c.check_out_time);

    // For technicians: filter to their own check-ins
    // For managers/admins: return all
    const filteredCheckIns = isManagerOrAdmin 
      ? activeCheckIns 
      : activeCheckIns.filter(c => c.technician_email === user.email);

    if (filteredCheckIns.length === 0) {
      return Response.json({ checkIns: [] });
    }

    // Batch fetch jobs (single query with multiple IDs)
    const jobIds = [...new Set(filteredCheckIns.map(c => c.job_id))];
    const jobs = jobIds.length > 0 
      ? await base44.asServiceRole.entities.Job.filter(
          { id: { $in: jobIds } },
          '-last_activity_at',
          100
        )
      : [];

    // Create lookup map for efficient pairing
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    // Pair check-ins with jobs
    const result = filteredCheckIns.map(checkIn => ({
      ...checkIn,
      job: jobMap.get(checkIn.job_id) || null
    }));

    return Response.json({ checkIns: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});