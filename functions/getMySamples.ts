import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admins, managers, and field technicians to see samples
    const isAuthorized = user.role === 'admin' || 
                        user.extended_role === 'manager' || 
                        user.is_field_technician;

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all samples using service role to bypass RLS
    const samples = await base44.asServiceRole.entities.Sample.list();

    return Response.json({ samples });
  } catch (error) {
    console.error('Error in getMySamples:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});