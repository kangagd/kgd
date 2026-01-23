import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Role-safe project list fetcher
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
            return Response.json({ error: 'Forbidden: Only admins and managers can list all projects' }, { status: 403 });
        }

        const { limit = 100, filters = {} } = await req.json();

        // Use service role to bypass RLS
        const projects = await base44.asServiceRole.entities.Project.filter(
            filters,
            '-last_activity_at',
            limit
        );

        // Sanitize: return only fields needed for UI lists
        const sanitized = projects.map(p => ({
            id: p.id,
            project_number: p.project_number,
            title: p.title,
            customer_id: p.customer_id,
            customer_name: p.customer_name,
            status: p.status,
            project_type: p.project_type,
            address_full: p.address_full,
            created_date: p.created_date,
            last_activity_at: p.last_activity_at,
            assigned_technicians: p.assigned_technicians,
            assigned_technicians_names: p.assigned_technicians_names,
            organisation_name: p.organisation_name,
            project_tags_snapshot: p.project_tags_snapshot,
            total_project_value: p.total_project_value,
            financial_status: p.financial_status,
        }));

        return Response.json({ projects: sanitized });
    } catch (error) {
        console.error('[getProjectsForRole] Error:', error);
        return Response.json({
            error: error.message,
            projects: []
        }, { status: 500 });
    }
});