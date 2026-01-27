import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all users using service role
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    // Filter to only admins and managers (can be assigned threads)
    const assignableUsers = allUsers.filter(u => u.role === 'admin' || u.extended_role === 'manager');

    return Response.json({ users: assignableUsers });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});