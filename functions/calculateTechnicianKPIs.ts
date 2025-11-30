import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format, startOfMonth, subMonths, parseISO } from 'npm:date-fns@2.30.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await req.json();
        // Allow admin/manager to calculate for others, or user for themselves
        const targetUserId = userId || user.id;
        
        if (targetUserId !== user.id && user.role !== 'admin' && user.role !== 'manager') {
             return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const targetUser = await base44.asServiceRole.entities.User.get(targetUserId);
        if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });

        // Fetch jobs for this technician
        // We look at completed jobs
        // Use 'assigned_to' (array of emails) - targetUser.email
        const jobs = await base44.asServiceRole.entities.Job.filter({
            assigned_to: targetUser.email,
            status: 'Completed',
            deleted_at: null
        }, '-scheduled_date', 500); // Fetch last 500 jobs

        // Fetch CheckIns for accurate timings
        // Ideally we filter by job_id but we have many jobs.
        // We can filter CheckInOut by technician_email
        const checkIns = await base44.asServiceRole.entities.CheckInOut.filter({
            technician_email: targetUser.email
        }, '-check_in_time', 1000);

        // Map checkins to jobs
        const checkInsByJob = {};
        checkIns.forEach(c => {
            if (!checkInsByJob[c.job_id]) checkInsByJob[c.job_id] = [];
            checkInsByJob[c.job_id].push(c);
        });

        // Metrics Calculation
        let totalJobs = jobs.length;
        let onTimeCount = 0;
        let totalDurationVariance = 0;
        let durationCount = 0;
        let revisitCount = 0;

        // For history
        const historyMap = {}; // "YYYY-MM": { total: 0, onTime: 0 }

        jobs.forEach(job => {
            const jobCheckIns = checkInsByJob[job.id] || [];
            // Find first check-in
            const firstCheckIn = jobCheckIns.sort((a,b) => new Date(a.check_in_time) - new Date(b.check_in_time))[0];
            
            // 1. On-Time Check-in
            if (firstCheckIn && job.scheduled_date && job.scheduled_time) {
                const scheduled = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
                const actual = new Date(firstCheckIn.check_in_time);
                const diffMinutes = (actual - scheduled) / 60000;
                
                // Allow 15 mins grace?
                if (diffMinutes <= 15) {
                    onTimeCount++;
                }
            }

            // 2. Duration Variance
            // Use aggregated duration from checkins or job.duration_minutes
            const actualDuration = job.duration_minutes || jobCheckIns.reduce((acc, c) => acc + (c.duration_hours || 0) * 60, 0);
            const expectedDuration = (job.expected_duration || 0) * 60; // expected is usually hours
            
            if (actualDuration > 0 && expectedDuration > 0) {
                const variance = (actualDuration - expectedDuration) / expectedDuration;
                // Cap variance to avoid skewing?
                totalDurationVariance += variance;
                durationCount++;
            }

            // 3. Re-visits
            if (job.outcome === 'return_visit_required') {
                revisitCount++;
            }

            // History grouping
            if (job.scheduled_date) {
                const monthKey = job.scheduled_date.substring(0, 7); // YYYY-MM
                if (!historyMap[monthKey]) historyMap[monthKey] = { total: 0, onTime: 0 };
                historyMap[monthKey].total++;
                // simplified on-time for history using same logic
                if (firstCheckIn && job.scheduled_time) {
                     const scheduled = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
                     const actual = new Date(firstCheckIn.check_in_time);
                     if ((actual - scheduled) / 60000 <= 15) {
                         historyMap[monthKey].onTime++;
                     }
                }
            }
        });

        const kpis = {
            jobs_completed_count: totalJobs,
            on_time_checkin_rate: totalJobs > 0 ? Math.round((onTimeCount / totalJobs) * 100) : 0,
            avg_duration_variance: durationCount > 0 ? parseFloat((totalDurationVariance / durationCount).toFixed(2)) : 0,
            revisit_rate: totalJobs > 0 ? Math.round((revisitCount / totalJobs) * 100) : 0,
            last_updated: new Date().toISOString(),
            history: Object.entries(historyMap)
                .sort((a,b) => b[0].localeCompare(a[0])) // Descending dates
                .slice(0, 12) // Last 12 months
                .map(([month, stats]) => ({
                    month,
                    jobs_completed: stats.total,
                    on_time_rate: stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0
                }))
                .reverse() // Ascending for chart
        };

        // Update User entity
        await base44.asServiceRole.entities.User.update(targetUserId, {
            technician_kpis: kpis
        });

        return Response.json({ success: true, kpis });

    } catch (error) {
        console.error('Calculate KPIs Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});