import { createClientFromRequest } from './shared/sdk.js';

/**
 * Role-safe logistics jobs fetcher
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
            return Response.json({ error: 'Forbidden: Only admins and managers can view all logistics jobs' }, { status: 403 });
        }

        const { status = null, purpose = null, date_from = null, date_to = null } = await req.json().catch(() => ({}));

        // Build filter
        const filter = { is_logistics_job: true };
        
        if (status) {
            filter.status = status;
        }
        
        if (purpose) {
            filter.logistics_purpose = purpose;
        }
        
        if (date_from && date_to) {
            filter.scheduled_date = { $gte: date_from, $lte: date_to };
        } else if (date_from) {
            filter.scheduled_date = { $gte: date_from };
        } else if (date_to) {
            filter.scheduled_date = { $lte: date_to };
        }

        // Use service role to bypass RLS
        const jobs = await base44.asServiceRole.entities.Job.filter(filter, '-scheduled_date');

        // Sanitize: return only fields needed for logistics UI
        const sanitized = jobs.map(j => ({
            id: j.id,
            job_number: j.job_number,
            project_id: j.project_id,
            project_name: j.project_name,
            customer_id: j.customer_id,
            customer_name: j.customer_name,
            job_type: j.job_type,
            job_type_name: j.job_type_name,
            assigned_to: j.assigned_to,
            assigned_to_name: j.assigned_to_name,
            scheduled_date: j.scheduled_date,
            scheduled_time: j.scheduled_time,
            status: j.status,
            is_logistics_job: j.is_logistics_job,
            logistics_purpose: j.logistics_purpose,
            purchase_order_id: j.purchase_order_id,
            vehicle_id: j.vehicle_id,
            origin_address: j.origin_address,
            destination_address: j.destination_address,
            address_full: j.address_full,
            stock_transfer_status: j.stock_transfer_status,
            notes: j.notes,
            reference_type: j.reference_type,
            reference_id: j.reference_id,
        }));

        return Response.json({ jobs: sanitized });
    } catch (error) {
        console.error('[getLogisticsJobsForRole] Error:', error);
        return Response.json({
            error: error.message,
            jobs: []
        }, { status: 500 });
    }
});