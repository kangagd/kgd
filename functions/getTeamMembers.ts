import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins and managers to fetch team members
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Forbidden: Only admins and managers can view team members' }, { status: 403 });
    }

    // Use service role to bypass User entity RLS
    const users = await base44.asServiceRole.entities.User.list();

    return Response.json({ users });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});