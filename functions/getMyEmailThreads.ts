import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admins and managers to fetch all email threads
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Forbidden: Only admins and managers can view inbox' }, { status: 403 });
    }

    // Use service role to bypass EmailThread entity RLS
    const threads = await base44.asServiceRole.entities.EmailThread.list('-last_message_date');

    return Response.json({ threads });
  } catch (error) {
    console.error('Error fetching email threads:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});