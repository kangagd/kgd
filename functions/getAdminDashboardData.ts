import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Open Jobs (Current)
        // We can use list/filter. For large datasets, count would be better if API supported it, but filter.length works for now.
        const openJobs = await base44.asServiceRole.entities.Job.filter({
            status: { $in: ['Open', 'Scheduled'] }
        });

        // 2. Jobs Completed Last 30 Days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const completedJobs30d = await base44.asServiceRole.entities.Job.filter({
            status: 'Completed',
            updated_date: { $gte: thirtyDaysAgo.toISOString() }
        });

        // 3. Upcoming Contract SLA Work
        // Jobs with contract_id and (Open/Scheduled)
        const contractJobs = await base44.asServiceRole.entities.Job.filter({
            contract_id: { $ne: null },
            status: { $in: ['Open', 'Scheduled'] }
        });

        // 4. Parts Awaiting Delivery
        const awaitingParts = await base44.asServiceRole.entities.Part.filter({
            status: { $in: ['Ordered', 'Back-ordered'] }
        });

        // 5. Charts Data
        // We need to fetch all jobs and invoices to aggregate them.
        // Limitation: If there are thousands, this might be slow. 
        // Ideally we'd use specific aggregation queries, but here we'll fetch all needed fields.
        
        // Jobs Trend (Completed per Month for last 12 months)
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const allCompletedJobs = await base44.asServiceRole.entities.Job.filter({
            status: 'Completed',
            updated_date: { $gte: oneYearAgo.toISOString() }
        });

        const jobsByMonth = {};
        allCompletedJobs.forEach(job => {
            // Use updated_date or scheduled_date
            const d = new Date(job.updated_date || job.scheduled_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            jobsByMonth[key] = (jobsByMonth[key] || 0) + 1;
        });

        const jobsChartData = Object.entries(jobsByMonth)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Revenue Trend (Xero Invoices per Month for last 12 months)
        const allInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
            date: { $gte: oneYearAgo.toISOString().split('T')[0] }
        });

        const revenueByMonth = {};
        allInvoices.forEach(inv => {
            const d = new Date(inv.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            revenueByMonth[key] = (revenueByMonth[key] || 0) + (inv.total || 0);
        });

        const revenueChartData = Object.entries(revenueByMonth)
            .map(([date, total]) => ({ date, total }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Job Types Distribution (Pie Chart) - Active Jobs
        // Or All Jobs? Usually "Job Types" distribution is interesting for all time or active. 
        // Let's do "Last 30 Days Created" or just "Open" jobs to see current workload mix.
        // User asked "Pie chart: Job types". Let's do all Open/Scheduled jobs to show current active mix.
        const jobTypeCounts = {};
        openJobs.forEach(job => {
            const type = job.job_type || 'Unspecified';
            jobTypeCounts[type] = (jobTypeCounts[type] || 0) + 1;
        });

        const jobTypesChartData = Object.entries(jobTypeCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return Response.json({
            cards: {
                openJobs: openJobs.length,
                completedJobs30d: completedJobs30d.length,
                contractSLAWork: contractJobs.length,
                partsAwaiting: awaitingParts.length
            },
            charts: {
                jobsCompleted: jobsChartData,
                revenue: revenueChartData,
                jobTypes: jobTypesChartData
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});