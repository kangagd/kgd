import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser || currentUser.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    // Use service role to fetch user data
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    return Response.json({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      extended_role: user.extended_role,
      is_field_technician: user.is_field_technician,
      display_name: user.display_name,
      status: user.status,
      all_fields: user
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});