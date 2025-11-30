import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // Scheduled functions run as service role, or we check for admin/service context
        // We'll use service role for analytics calculations

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Total Jobs Open
        // Status: Open or Scheduled
        const openJobs = await base44.asServiceRole.entities.Job.filter({
            status: { $in: ['Open', 'Scheduled'] }
        });
        const totalJobsOpen = openJobs.length;

        // 2. Total Jobs Completed Last 30 Days
        // Status: Completed, scheduled_date >= 30 days ago (Approximation as completed_at might be in summary)
        // Better: check JobSummary for checkout_time >= 30 days ago if possible, but keeping it simple with Job entity first if feasible.
        // Let's use Job.scheduled_date as a proxy if status is Completed, or just fetch all completed and filter in memory if dataset isn't huge.
        // Assuming fetch filtering is efficient.
        const completedJobs = await base44.asServiceRole.entities.Job.filter({
            status: 'Completed',
            scheduled_date: { $gte: thirtyDaysAgo.split('T')[0] }
        });
        const totalJobsCompletedLast30 = completedJobs.length;

        // 3. Total Projects In Progress
        // Status NOT: Completed, Lost, Lead, Warranty, Quote Sent (maybe? usually in progress implies active work)
        // Let's assume "In Progress" = Initial Site Visit, Quote Approved, Final Measure, Parts Ordered, Scheduled
        const inProgressStatuses = [
            'Initial Site Visit', 
            'Quote Approved', 
            'Final Measure', 
            'Parts Ordered', 
            'Scheduled'
        ];
        const projectsInProgress = await base44.asServiceRole.entities.Project.filter({
            status: { $in: inProgressStatuses }
        });
        const totalProjectsInProgress = projectsInProgress.length;

        // 4. Contract Jobs Due
        // Jobs with contract_id that are Open/Scheduled and sla_due_at is set (or just active contract jobs)
        // "Due" usually implies they need attention. Let's count open contract jobs.
        const contractJobs = await base44.asServiceRole.entities.Job.filter({
            contract_id: { $ne: null },
            status: { $in: ['Open', 'Scheduled'] }
        });
        const contractJobsDue = contractJobs.length;

        // 5. SLA Breaches
        // Jobs where sla_met is false (explicit breach)
        // Or jobs where sla_due_at < now and status is not Completed (active breach)
        // We'll count explicit 'sla_met: false' + active overdue
        const explicitBreaches = await base44.asServiceRole.entities.Job.filter({
            sla_met: false
        });
        
        // Active overdue
        const activeOverdue = await base44.asServiceRole.entities.Job.filter({
            status: { $in: ['Open', 'Scheduled'] },
            sla_due_at: { $lt: now.toISOString() }
        });

        // Merge unique IDs (though active overdue might not have sla_met set yet)
        const breachIds = new Set([
            ...explicitBreaches.map(j => j.id),
            ...activeOverdue.map(j => j.id)
        ]);
        const slaBreaches = breachIds.size;

        // 6. Revenue Last 30 Days
        // Sum XeroInvoice totals where date >= 30 days ago
        const recentInvoices = await base44.asServiceRole.entities.XeroInvoice.filter({
            date: { $gte: thirtyDaysAgo.split('T')[0] }
        });
        const revenueLast30Days = recentInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        // 7. Avg Job Duration Hours
        // Use JobSummary check_in/check_out or duration_minutes
        // We'll fetch JobSummaries for the completed jobs (or just recent summaries)
        const recentSummaries = await base44.asServiceRole.entities.JobSummary.filter({
            check_out_time: { $gte: thirtyDaysAgo }
        });
        
        let avgJobDurationHours = 0;
        if (recentSummaries.length > 0) {
            const totalMinutes = recentSummaries.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
            avgJobDurationHours = (totalMinutes / recentSummaries.length) / 60;
        }

        // Create Snapshot
        const snapshot = await base44.asServiceRole.entities.AnalyticsSnapshot.create({
            date: todayStr,
            total_jobs_open: totalJobsOpen,
            total_jobs_completed_last_30: totalJobsCompletedLast30,
            total_projects_in_progress: totalProjectsInProgress,
            contract_jobs_due: contractJobsDue,
            sla_breaches: slaBreaches,
            revenue_last_30_days: revenueLast30Days,
            avg_job_duration_hours: parseFloat(avgJobDurationHours.toFixed(2))
        });

        return Response.json({ success: true, snapshot });

    } catch (error) {
        console.error("Analytics Snapshot Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});