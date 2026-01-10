import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin, manager, and technician can get user list
    const hasAccess = user.role === 'admin' || 
                      user.extended_role === 'manager' || 
                      user.extended_role === 'technician' ||
                      user.is_field_technician === true;

    if (!hasAccess) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users with service role
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Return limited fields only
    const users = allUsers.map(u => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name || u.full_name,
      full_name: u.full_name,
      role: u.role,
      extended_role: u.extended_role
    }));

    return Response.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});