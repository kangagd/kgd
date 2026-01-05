import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return all user fields to diagnose role issues
    return Response.json({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      extended_role: user.extended_role,
      is_field_technician: user.is_field_technician,
      display_name: user.display_name,
      all_fields: user
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});