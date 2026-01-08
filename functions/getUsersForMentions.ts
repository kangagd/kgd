import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Require authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to fetch all users (bypasses RLS)
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Filter to active users only and sanitize
    const sanitizedUsers = allUsers
      .filter(u => !u.deleted_at) // Exclude soft-deleted users
      .map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        display_name: u.display_name,
        is_field_technician: u.is_field_technician || false,
        role: u.role,
        extended_role: u.extended_role
      }));

    return Response.json({ users: sanitizedUsers });

  } catch (error) {
    console.error('[getUsersForMentions] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});