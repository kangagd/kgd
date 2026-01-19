import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const effectiveRole = user.role === 'admin' || user.extended_role === 'manager' 
      ? 'manager' 
      : 'technician';

    // 1. Fetch active check-ins
    const checkInFilter = { check_out_time: { $exists: false } };
    if (effectiveRole === 'technician') {
      checkInFilter.technician_email = user.email;
    }
    const activeCheckIns = await base44.entities.CheckInOut.filter(checkInFilter);

    if (activeCheckIns.length === 0) {
      // For technicians, return null; for managers, return empty array.
      return new Response(JSON.stringify(effectiveRole === 'manager' ? [] : null), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Collect unique job IDs
    const jobIds = [...new Set(activeCheckIns.map(c => c.job_id).filter(Boolean))];

    if (jobIds.length === 0) {
        // Return checkins without jobs if no job_ids are found
        const checkInsWithNullJobs = activeCheckIns.map(checkIn => ({ ...checkIn, job: null }));
        const responseData = effectiveRole === 'manager' ? checkInsWithNullJobs : (checkInsWithNullJobs[0] || null);
        return new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 3. Fetch jobs in one query
    const jobs = await base44.entities.Job.filter({ id: { $in: jobIds } });
    const jobsById = new Map(jobs.map(j => [j.id, j]));

    // 4. Combine check-ins with jobs
    const checkInsWithJobs = activeCheckIns.map(checkIn => ({
      ...checkIn,
      job: jobsById.get(checkIn.job_id) || null,
    }));

    // 5. Return response based on role
    const responseData = effectiveRole === 'manager' ? checkInsWithJobs : (checkInsWithJobs[0] || null);

    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in getActiveCheckInsWithJobs:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});