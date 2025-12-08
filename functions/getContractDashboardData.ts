import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => ({})); // Handle empty body
        const { contract_id } = body;

        // 1. Stations List (Customers with is_station=true)
        let stationFilter = { is_station: true };
        if (contract_id) stationFilter.contract_id = contract_id;
        const stations = await base44.asServiceRole.entities.Customer.filter(stationFilter);

        // 2. Open Jobs Count
        let jobFilter = { 
            is_contract_job: true,
            status: { $nin: ['Completed', 'Cancelled'] } 
        };
        if (contract_id) jobFilter.contract_id = contract_id;
        const openJobs = await base44.asServiceRole.entities.Job.filter(jobFilter);
        const openJobsCount = openJobs.length;

        // 3. SLA Breaches
        // Filter jobs where sla_due_at < now and status != Completed
        // Since we can't do complex date comparisons in filter sometimes, we might need to fetch and filter in memory
        // We can re-use openJobs since they are not completed.
        const now = new Date();
        const slaBreaches = openJobs.filter(job => {
            return job.sla_due_at && new Date(job.sla_due_at) < now;
        });

        // 4. Upcoming Maintenance Jobs
        let maintenanceFilter = {
            // job_type like 'Maintenance' - fuzzy search might not work in filter, assume exact or fetch all and filter
            status: { $nin: ['Completed', 'Cancelled'] }
        };
        if (contract_id) maintenanceFilter.contract_id = contract_id;
        
        // Fetch potential maintenance jobs
        // Better to fetch all open jobs (we have openJobs) and filter
        const upcomingMaintenance = openJobs.filter(job => {
            const type = (job.job_type || "").toLowerCase();
            const typeName = (job.job_type_name || "").toLowerCase();
            const isMaintenance = type.includes('maintenance') || typeName.includes('maintenance');
            const isFuture = job.scheduled_date && new Date(job.scheduled_date) > now;
            return isMaintenance && isFuture;
        });

        // 5. Recent Completed Jobs
        let completedFilter = {
            status: 'Completed',
            is_contract_job: true
        };
        if (contract_id) completedFilter.contract_id = contract_id;
        const recentCompleted = await base44.asServiceRole.entities.Job.filter(completedFilter, '-updated_date', 5);

        // 6. Financial Data - fetch all invoices for contract jobs
        let allContractJobs = [];
        if (contract_id) {
            // Get all jobs under this contract
            const directJobs = await base44.asServiceRole.entities.Job.filter({ contract_id });
            const stationIds = stations.map(s => s.id);
            const stationJobs = stationIds.length > 0 
                ? await Promise.all(stationIds.map(id => base44.asServiceRole.entities.Job.filter({ customer_id: id })))
                : [];
            allContractJobs = [...directJobs, ...stationJobs.flat()];
        }
        
        // Get invoices for all contract jobs
        const jobIds = allContractJobs.map(j => j.id).filter(Boolean);
        let invoices = [];
        if (jobIds.length > 0) {
            invoices = await base44.asServiceRole.entities.XeroInvoice.list();
            invoices = invoices.filter(inv => jobIds.includes(inv.job_id));
        }

        // Calculate financial totals
        let totalBalance = 0;
        let totalOwing = 0;
        
        invoices.forEach(inv => {
            if (inv.status !== 'VOIDED') {
                totalBalance += (inv.total || inv.total_amount || 0);
                totalOwing += (inv.amount_due || 0);
            }
        });

        return Response.json({
            stations: stations.map(s => ({ id: s.id, name: s.name })),
            open_jobs_count: openJobsCount,
            sla_breaches_count: slaBreaches.length,
            sla_breaches: slaBreaches.map(j => ({ id: j.id, job_number: j.job_number, customer_name: j.customer_name, sla_due_at: j.sla_due_at })),
            upcoming_maintenance: upcomingMaintenance.map(j => ({ id: j.id, job_number: j.job_number, scheduled_date: j.scheduled_date })),
            recent_completed: recentCompleted.map(j => ({ id: j.id, job_number: j.job_number, completed_date: j.updated_date })),
            total_balance: totalBalance,
            total_owing: totalOwing,
            invoice_count: invoices.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});