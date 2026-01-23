import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all check-in records with active check-ins (no check_out_time)
    const allCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({ 
      check_out_time: { $exists: false } 
    });

    if (allCheckIns.length === 0) {
      return Response.json({ checkIns: [] });
    }

    // Get unique job IDs and fetch jobs in batch
    const jobIds = [...new Set(allCheckIns.map(c => c.job_id))];
    const jobs = await Promise.all(
      jobIds.map(jId => base44.asServiceRole.entities.Job.get(jId).catch(() => null))
    );
    const jobMap = Object.fromEntries(jobs.filter(Boolean).map(j => [j.id, j]));

    // Get unique technician emails and fetch user details
    const techEmails = [...new Set(allCheckIns.map(c => c.technician_email))];
    const techUsers = await Promise.all(
      techEmails.map(email => base44.asServiceRole.entities.User.filter({ email }).then(u => u[0] || null).catch(() => null))
    );
    const techMap = Object.fromEntries(techUsers.filter(Boolean).map(t => [t.email, t]));

    // Build rich check-in objects
    const checkIns = allCheckIns
      .filter(checkIn => jobMap[checkIn.job_id]) // Only include if job exists
      .map(checkIn => {
        const job = jobMap[checkIn.job_id];
        const tech = techMap[checkIn.technician_email];
        
        return {
          id: checkIn.id,
          job_id: checkIn.job_id,
          technician_email: checkIn.technician_email,
          technician_name: checkIn.technician_name,
          check_in_time: checkIn.check_in_time,
          job_number: job.job_number,
          job_status: job.status,
          customer_name: job.customer_name,
          customer_phone: job.customer_phone,
          address: job.address_full || job.address,
          assigned_to: job.assigned_to,
          assigned_to_name: job.assigned_to_name,
          scheduled_date: job.scheduled_date,
          scheduled_time: job.scheduled_time,
          job_type_name: job.job_type_name,
          tech_role: tech?.role,
          tech_extended_role: tech?.extended_role
        };
      });

    return Response.json({ checkIns });
  } catch (error) {
    console.error('Error fetching active check-ins with jobs:', error);
    return Response.json({ error: error.message, checkIns: [] }, { status: 500 });
  }
});