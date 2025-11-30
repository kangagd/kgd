import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { startOfMonth, endOfMonth, subMonths } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Allow this to be triggered via API (e.g. scheduler or manual test)
        // Verify admin or service role if called directly via API, but for scheduler it might be internal.
        // We'll use service role for data access.
        
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();
        
        // 1. Aggregates
        const [allProjects, allJobs, jobSummaries] = await Promise.all([
            base44.asServiceRole.entities.Project.list(),
            base44.asServiceRole.entities.Job.list(),
            base44.asServiceRole.entities.JobSummary.list()
        ]);

        const activeProjects = allProjects.filter(p => !p.deleted_at);
        const activeJobs = allJobs.filter(j => !j.deleted_at);

        // 2. Monthly Metrics
        const jobsCompletedThisMonth = activeJobs.filter(j => 
            j.status === 'Completed' && 
            j.updated_date >= monthStart && 
            j.updated_date <= monthEnd
        );

        // SLA Breaches (Jobs active or completed this month that breached)
        const slaBreachesThisMonth = activeJobs.filter(j => {
            if (!j.sla_due_at) return false;
            const dueDate = new Date(j.sla_due_at);
            // If completed, check if completed after due date
            if (j.status === 'Completed') {
                // We need a completed_at. Using updated_date as proxy if completion_date missing
                // Or verify if we have a better field. Assuming updated_date for now or check jobSummaries.
                const completedDate = new Date(j.updated_date); 
                return completedDate > dueDate && completedDate >= new Date(monthStart) && completedDate <= new Date(monthEnd);
            }
            // If open and overdue
            return dueDate < now && dueDate >= new Date(monthStart);
        }).length;

        // Revenue (Completed Projects this month)
        // Using 'completed_date' if available, else 'updated_date' for 'Completed' status
        const revenueThisMonth = activeProjects
            .filter(p => {
                const compDate = p.completed_date ? new Date(p.completed_date) : (p.status === 'Completed' ? new Date(p.updated_date) : null);
                return compDate && compDate >= new Date(monthStart) && compDate <= new Date(monthEnd);
            })
            .reduce((sum, p) => sum + (p.total_project_value || 0), 0);

        // Average Duration
        const validDurations = jobSummaries.filter(js => js.duration_minutes).map(js => js.duration_minutes);
        const avgDuration = validDurations.length > 0 
            ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length 
            : 0;

        // Top Job Types
        const jobTypeCounts = {};
        activeJobs.forEach(j => {
            const type = j.job_type || 'Unknown';
            jobTypeCounts[type] = (jobTypeCounts[type] || 0) + 1;
        });
        const topJobTypes = Object.entries(jobTypeCounts)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Top Clients (by Project Value)
        const clientValues = {};
        activeProjects.forEach(p => {
            if (p.customer_name) {
                clientValues[p.customer_name] = (clientValues[p.customer_name] || 0) + (p.total_project_value || 0);
            }
        });
        const topClients = Object.entries(clientValues)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Technician Performance
        const techStats = {};
        jobsCompletedThisMonth.forEach(j => {
            const techs = j.assigned_to || []; // Array of emails
            // Ensure it's array
            const techList = Array.isArray(techs) ? techs : (techs ? [techs] : []);
            
            techList.forEach(email => {
                if (!techStats[email]) techStats[email] = { completed: 0, sla_breach_count: 0 };
                techStats[email].completed++;
                
                if (j.sla_due_at) {
                    const dueDate = new Date(j.sla_due_at);
                    const completedDate = new Date(j.updated_date);
                    if (completedDate > dueDate) {
                        techStats[email].sla_breach_count++;
                    }
                }
            });
        });

        const snapshot = {
            snapshot_date: now.toISOString().split('T')[0],
            total_projects: activeProjects.length,
            total_jobs: activeJobs.length,
            jobs_completed_this_month: jobsCompletedThisMonth.length,
            sla_breaches_this_month: slaBreachesThisMonth,
            average_job_duration: Math.round(avgDuration),
            top_job_types: topJobTypes,
            top_clients: topClients,
            technician_performance: techStats,
            revenue_this_month: revenueThisMonth,
            generated_at: now.toISOString()
        };

        await base44.asServiceRole.entities.AnalyticsSnapshot.create(snapshot);

        return Response.json({ success: true, snapshot });

    } catch (error) {
        console.error("Generate Analytics Snapshot Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});