import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { subDays, addDays, format } from 'npm:date-fns@2.30.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
             return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Date calculations
        const staleDateThreshold = subDays(new Date(), 60).toISOString();
        const expiringContractThreshold = addDays(new Date(), 30).toISOString().split('T')[0]; // Date format YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];

        // 1. Stale Data (Projects not updated in > 60 days and not closed)
        // Filter: updated_date < threshold AND status NOT IN [Completed, Lost, Cancelled]
        // Note: SDK might not support advanced query like NOT IN easily in one go if not supported by backend.
        // We'll fetch active projects and filter in memory if needed, or assume 'status' filter logic.
        // Better to fetch 'stale' candidates.
        // SDK filter usually supports simple equality or mongo-like operators if supported by backend.
        // Let's try fetching all active projects and filtering by date in memory to be safe, or use $lt for date.
        // Assuming 'updated_date' exists (standard field).
        
        const activeProjects = await base44.asServiceRole.entities.Project.filter({
            status: { $nin: ['Completed', 'Lost', 'Warranty'] },
            updated_date: { $lt: staleDateThreshold }
        });

        const staleJobs = await base44.asServiceRole.entities.Job.filter({
            status: { $nin: ['Completed', 'Cancelled'] },
            updated_date: { $lt: staleDateThreshold }
        });

        // 2. Orphaned Jobs (No project_id)
        // SDK: queries for null might be { project_id: null } or { project_id: { $exists: false } }
        // Let's try { project_id: null }
        const orphanedJobs = await base44.asServiceRole.entities.Job.filter({
            project_id: null
        });

        // 3. Orphaned Quotes (No project_id AND No job_id)
        const quotes = await base44.asServiceRole.entities.Quote.filter({
            project_id: null,
            job_id: null
        });

        // 4. Contracts Expiring Soon (Active and end_date <= 30 days from now and >= today)
        const expiringContracts = await base44.asServiceRole.entities.Contract.filter({
            status: 'Active',
            end_date: { $lte: expiringContractThreshold, $gte: today }
        });

        // 5. Unlinked Parts (No project_id and no vehicle_id)
        const unlinkedParts = await base44.asServiceRole.entities.Part.filter({
            project_id: null,
            vehicle_id: null
        });

        // 6. Errors Logged (ReportResult failed, ActivityLog errors)
        const failedReports = await base44.asServiceRole.entities.ReportResult.filter({
            status: 'failed'
        });
        
        // Optionally check ActivityLog if possible
        // const errorLogs = await base44.asServiceRole.entities.ActivityLog.filter({ action: 'error' });

        return Response.json({
            staleProjects: activeProjects.map(p => ({ id: p.id, title: p.title, date: p.updated_date })),
            staleJobs: staleJobs.map(j => ({ id: j.id, number: j.job_number, title: j.project_name || 'Job', date: j.updated_date })),
            orphanedJobs: orphanedJobs.map(j => ({ id: j.id, number: j.job_number, title: j.project_name })),
            orphanedQuotes: quotes.map(q => ({ id: q.id, name: q.name, value: q.value })),
            expiringContracts: expiringContracts.map(c => ({ id: c.id, name: c.name, end_date: c.end_date })),
            unlinkedParts: unlinkedParts.map(p => ({ id: p.id, name: p.category, status: p.status })),
            failedReports: failedReports.map(r => ({ id: r.id, generated_at: r.generated_at, error: r.error_message }))
        });

    } catch (error) {
        console.error("System Health Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});