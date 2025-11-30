import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { technician_email, date_from, date_to, job_type } = await req.json();

        // Build filter
        const filter = {
            deleted_at: null,
            status: 'Completed' // Only count completed jobs for performance stats
        };

        if (technician_email && technician_email !== 'all') {
            // assigned_to is an array of strings
            filter.assigned_to = technician_email;
        }

        if (job_type && job_type !== 'all') {
             // Simple fuzzy match or exact match depending on how frontend sends it
             // Entity filter usually exact. Let's assume exact or use $regex if needed but entity SDK is simple.
             // If job_type is name, check job_type_name field
             filter.job_type = job_type;
        }

        // Date filter
        const dateFilter = {};
        if (date_from) dateFilter.$gte = date_from;
        if (date_to) dateFilter.$lte = date_to;
        
        if (Object.keys(dateFilter).length > 0) {
            filter.scheduled_date = dateFilter;
        }

        // Fetch Jobs
        // We might need a lot of jobs, limit is 50 by default. Let's ask for more.
        // Pagination might be needed but for stats we want all matching.
        // SDK .list accepts limit. Let's try 1000.
        const jobs = await base44.asServiceRole.entities.Job.filter(filter, '-scheduled_date', 1000);

        // 1. Jobs per Technician
        const jobsPerTech = {};
        
        // 2. Duration Stats
        const durationByType = {}; // { type: { total: 0, count: 0 } }
        
        // 3. Return Visits
        let totalReturnVisits = 0;

        // 4. Locations
        const locations = [];

        jobs.forEach(job => {
            // Count per tech
            const techs = job.assigned_to || [];
            const techList = Array.isArray(techs) ? techs : [techs];
            
            techList.forEach(email => {
                if (!email) return;
                if (!jobsPerTech[email]) jobsPerTech[email] = { count: 0, name: job.assigned_to_name?.[techList.indexOf(email)] || email.split('@')[0] };
                jobsPerTech[email].count++;
            });

            // Duration
            const type = job.job_type || 'Unspecified';
            if (!durationByType[type]) durationByType[type] = { total: 0, count: 0 };
            
            // Prefer actual duration from JobSummary/check-in if aggregated to Job, else expected
            // Job entity has duration_minutes (actual) or expected_duration
            const duration = job.duration_minutes || (job.expected_duration * 60) || 0;
            if (duration > 0) {
                durationByType[type].total += duration;
                durationByType[type].count++;
            }

            // Return Visit
            if (job.outcome === 'return_visit_required') {
                totalReturnVisits++;
            }

            // Location
            if (job.latitude && job.longitude) {
                locations.push({ lat: job.latitude, lng: job.longitude, title: job.job_number });
            }
        });

        // Format Output
        const jobsByTechnician = Object.entries(jobsPerTech).map(([email, data]) => ({
            email,
            name: data.name,
            count: data.count
        })).sort((a, b) => b.count - a.count);

        const avgDurationByType = Object.entries(durationByType).map(([type, data]) => ({
            type,
            avg_minutes: Math.round(data.total / data.count)
        }));

        const returnRate = jobs.length > 0 ? Math.round((totalReturnVisits / jobs.length) * 100) : 0;

        return Response.json({
            total_jobs: jobs.length,
            jobs_by_technician: jobsByTechnician,
            avg_duration_by_type: avgDurationByType,
            return_visit_rate: returnRate,
            return_visit_count: totalReturnVisits,
            locations: locations
        });

    } catch (error) {
        console.error("Get Technician Stats Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});