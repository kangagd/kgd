import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service role can list all technicians regardless of user role
    const technicians = await base44.asServiceRole.entities.User.filter({ is_field_technician: true });

    return Response.json({
      success: true,
      technicians: technicians
    });
  } catch (error) {
    console.error('Get technicians error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});