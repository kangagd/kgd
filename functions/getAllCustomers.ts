import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Allow admin, manager, and regular users to see all customers
        const isAuthorized = user.role === 'admin' || user.extended_role === 'manager' || user.role === 'user';

        if (!isAuthorized) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all non-deleted customers using service role to bypass RLS
        const customers = await base44.asServiceRole.entities.Customer.filter({
            deleted_at: { $exists: false }
        });

        return Response.json({ 
            success: true, 
            customers: customers
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});