import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contract_id } = await req.json();

    if (!contract_id) {
      return Response.json({ error: 'Contract ID required' }, { status: 400 });
    }

    // Parallel fetch for efficiency
    const [
      stations,
      allJobs
    ] = await Promise.all([
      base44.entities.Customer.filter({ contract_id }),
      base44.entities.Job.filter({ contract_id }, '-scheduled_date')
    ]);

    const now = new Date();
    const openJobs = allJobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled');
    
    // SLA Breaches: Open jobs past SLA due date
    const slaBreaches = openJobs.filter(j => {
      if (!j.sla_due_at) return false;
      return new Date(j.sla_due_at) < now;
    });

    // Upcoming Maintenance: Future jobs with "Maintenance" in type or description
    const upcomingMaintenance = allJobs.filter(j => {
      if (!j.scheduled_date) return false;
      const isFuture = new Date(j.scheduled_date) > now;
      const isMaintenance = (j.job_type_name || '').toLowerCase().includes('maintenance') || 
                            (j.job_type || '').toLowerCase().includes('maintenance');
      return isFuture && isMaintenance && j.status !== 'Cancelled';
    }).sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).slice(0, 10);

    // Recent Completed: Completed in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCompleted = allJobs.filter(j => {
      if (j.status !== 'Completed') return false;
      // Use completion date or updated_at as proxy
      const date = j.completed_at || j.updated_at || j.scheduled_date;
      return new Date(date) > thirtyDaysAgo;
    }).sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date)).slice(0, 10);

    return Response.json({
      stations: stations.map(s => ({ id: s.id, name: s.name, address: s.address_full || s.address })),
      open_jobs_count: openJobs.length,
      sla_breaches: slaBreaches.map(j => ({
        id: j.id,
        job_number: j.job_number,
        customer_name: j.customer_name,
        sla_due_at: j.sla_due_at
      })),
      sla_breaches_count: slaBreaches.length,
      upcoming_maintenance: upcomingMaintenance.map(j => ({
        id: j.id,
        job_number: j.job_number,
        scheduled_date: j.scheduled_date,
        status: j.status
      })),
      recent_completed: recentCompleted.map(j => ({
        id: j.id,
        job_number: j.job_number,
        customer_name: j.customer_name,
        status: j.status,
        scheduled_date: j.scheduled_date
      }))
    });

  } catch (error) {
    console.error('getContractDashboardData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});