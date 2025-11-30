import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { contractId } = await req.json();
        if (!contractId) return Response.json({ error: 'Contract ID required' }, { status: 400 });

        // 1. Fetch Contract
        const contract = await base44.asServiceRole.entities.Contract.get(contractId);
        if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

        // 2. Fetch Related Data
        // Jobs
        const jobs = await base44.asServiceRole.entities.Job.filter({ contract_id: contractId }, '-scheduled_date', 1000);
        
        // Stations (Customers) - needed for mapping names
        const stations = await base44.asServiceRole.entities.Customer.filter({ contract_id: contractId }, 'name', 1000);
        const stationMap = stations.reduce((acc, s) => {
            acc[s.id] = s.name;
            return acc;
        }, {});

        // Invoices
        // Assuming invoices are linked to Organisation
        let invoices = [];
        if (contract.organisation_id) {
            invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ 
                organisation_id: contract.organisation_id 
            }, '-date', 1000);
        }

        // 3. Process Metrics

        // A. Jobs by Station
        const jobsByStation = {};
        jobs.forEach(job => {
            if (job.status === 'Completed' && job.customer_id) {
                const stationName = stationMap[job.customer_id] || 'Unknown';
                jobsByStation[stationName] = (jobsByStation[stationName] || 0) + 1;
            }
        });
        const workByStation = Object.entries(jobsByStation)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10

        // B. Job Type Distribution
        const jobTypeCounts = {};
        jobs.forEach(job => {
            const type = job.job_type || 'Unspecified';
            jobTypeCounts[type] = (jobTypeCounts[type] || 0) + 1;
        });
        const jobTypeDistribution = Object.entries(jobTypeCounts)
            .map(([name, value]) => ({ name, value }));

        // C. SLA Performance (Monthly)
        const slaByMonth = {}; // "YYYY-MM": { total: 0, met: 0 }
        jobs.forEach(job => {
            if (job.scheduled_date && job.is_contract_job) {
                const month = job.scheduled_date.substring(0, 7);
                if (!slaByMonth[month]) slaByMonth[month] = { total: 0, met: 0 };
                
                slaByMonth[month].total++;
                if (job.sla_met) slaByMonth[month].met++;
            }
        });
        const slaPerformance = Object.entries(slaByMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, stats]) => ({
                month,
                percentage: stats.total > 0 ? Math.round((stats.met / stats.total) * 100) : 100,
                total: stats.total,
                met: stats.met
            }));

        // D. Outstanding Work
        const outstandingWork = jobs
            .filter(j => j.status !== 'Completed' && j.status !== 'Cancelled')
            .map(j => ({
                id: j.id,
                job_number: j.job_number,
                title: j.project_name || j.job_type || 'Job',
                station: stationMap[j.customer_id] || 'Unknown',
                status: j.status,
                date: j.scheduled_date,
                sla_due: j.sla_due_at
            }))
            .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'));

        // E. Monthly Spend (Xero)
        const spendByMonth = {};
        invoices.forEach(inv => {
            if (inv.date && inv.total) {
                const month = inv.date.substring(0, 7);
                spendByMonth[month] = (spendByMonth[month] || 0) + inv.total;
            }
        });
        const monthlySpend = Object.entries(spendByMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, total]) => ({ month, total }));

        // F. Parts Replaced (Simple count from job.part_ids for now)
        let totalPartsReplaced = 0;
        jobs.forEach(j => {
            if (j.part_ids && Array.isArray(j.part_ids)) {
                totalPartsReplaced += j.part_ids.length;
            }
        });

        return Response.json({
            workByStation,
            jobTypeDistribution,
            slaPerformance,
            outstandingWork,
            monthlySpend,
            totalPartsReplaced,
            slaBreachesTotal: jobs.filter(j => j.is_contract_job && j.sla_met === false).length
        });

    } catch (error) {
        console.error("Contract Analytics Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});