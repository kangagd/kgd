import { createClientFromRequest } from './shared/sdk.js';

/**
 * Safe roster function: returns team user list without hitting RLS restrictions
 * 
 * Allowed roles: admin, manager, technician
 * Returns only safe fields for UI display
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Compute effective role
        const role = (user.extended_role || user.role || '').toLowerCase();
        const isAdmin = user.role === 'admin' || role === 'admin';
        const isManager = role === 'manager';
        const isTech = role === 'technician' || user.is_field_technician === true;

        // Allow: admin, manager, technician (anyone who needs roster access)
        if (!(isAdmin || isManager || isTech)) {
            return Response.json({
                error: 'Forbidden: Insufficient permissions for roster access',
                users: []
            }, { status: 403 });
        }

        // Service role: unrestricted list
        const allUsers = await base44.asServiceRole.entities.User.list();

        // Filter: exclude inactive users unless requester is admin
        const filtered = allUsers.filter(u => isAdmin || u.is_active !== false);

        // Project safe fields
        const users = filtered.map(u => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name || u.full_name || u.email,
            full_name: u.full_name,
            extended_role: u.extended_role,
            is_active: u.is_active !== false,
            aliases: u.aliases || [],
            org_emails: u.org_emails || []
        }));

        // Sort by display name
        users.sort((a, b) => {
            const aName = a.display_name || a.email;
            const bName = b.display_name || b.email;
            return aName.localeCompare(bName);
        });

        return Response.json({ users });
    } catch (error) {
        console.error('[getTeamUsers] Error:', error);
        return Response.json({
            error: error.message,
            users: []
        }, { status: 500 });
    }
});