import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins and managers to fetch technicians
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Forbidden: Only admins and managers can view technicians' }, { status: 403 });
    }

    // Use service role to bypass User entity RLS
    const technicians = await base44.asServiceRole.entities.User.filter({ 
      is_field_technician: true 
    });

    return Response.json({ technicians });
  } catch (error) {
    console.error('Error fetching technicians:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});