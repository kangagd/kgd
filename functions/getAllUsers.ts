import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Allow all authenticated users to see user list (needed for mentions in chat)

        // Fetch all users using service role to bypass RLS
        const users = await base44.asServiceRole.entities.User.filter({ 
            status: { $ne: 'inactive' } 
        });

        return Response.json({ 
            success: true, 
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                full_name: u.full_name,
                display_name: u.display_name,
                role: u.role,
                extended_role: u.extended_role,
                is_field_technician: u.is_field_technician,
                job_title: u.job_title
            }))
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});