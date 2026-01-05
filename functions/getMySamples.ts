import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view samples (admin, manager, or technician)
    const hasPermission = user.role === 'admin' || 
                         user.extended_role === 'manager' || 
                         user.is_field_technician;

    if (!hasPermission) {
      return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Use service role to bypass RLS and fetch all samples
    const samples = await base44.asServiceRole.entities.Sample.list();

    return Response.json({ samples });
  } catch (error) {
    console.error('Error in getMySamples:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});