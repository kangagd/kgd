import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Role-safe schedule fetcher
 * Prevents RLS empty-page issues for managers/admins
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check role: admin or manager
        const role = (user.extended_role || user.role || "").toLowerCase();
        const isAdmin = user.role === 'admin' || role === 'admin';
        const isManager = role === 'manager';

        if (!(isAdmin || isManager)) {
            return Response.json({ error: 'Forbidden: Only admins and managers can view full schedule' }, { status: 403 });
        }

        const { date_from = null, date_to = null } = await req.json().catch(() => ({}));

        // Build filter for date range (optional)
        const filter = {};
        if (date_from && date_to) {
            filter.scheduled_date = { $gte: date_from, $lte: date_to };
        } else if (date_from) {
            filter.scheduled_date = { $gte: date_from };
        } else if (date_to) {
            filter.scheduled_date = { $lte: date_to };
        }

        // Use service role to bypass RLS
        const jobs = await base44.asServiceRole.entities.Job.filter(filter);

        // Sanitize: return only fields needed for schedule UI
        const sanitized = jobs.map(j => ({
            id: j.id,
            job_number: j.job_number,
            project_id: j.project_id,
            project_name: j.project_name,
            project_number: j.project_number,
            customer_id: j.customer_id,
            customer_name: j.customer_name,
            customer_phone: j.customer_phone,
            job_type: j.job_type,
            job_type_name: j.job_type_name,
            job_type_id: j.job_type_id,
            assigned_to: j.assigned_to,
            assigned_to_name: j.assigned_to_name,
            scheduled_date: j.scheduled_date,
            scheduled_time: j.scheduled_time,
            expected_duration: j.expected_duration,
            status: j.status,
            address_full: j.address_full,
            notes: j.notes,
            is_logistics_job: j.is_logistics_job,
            logistics_purpose: j.logistics_purpose,
            scheduled_visits: j.scheduled_visits,
        }));

        return Response.json({ jobs: sanitized });
    } catch (error) {
        console.error('[getScheduleForRole] Error:', error);
        return Response.json({
            error: error.message,
            jobs: []
        }, { status: 500 });
    }
});