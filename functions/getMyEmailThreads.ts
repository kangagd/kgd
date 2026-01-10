import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const permissions = await base44.entities.EmailPermission.filter({ 
      user_email: user.email 
    });

    const hasAccess = permissions.length > 0 && permissions[0].can_view;
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';

    if (!hasAccess && !isAdminOrManager) {
      return Response.json({ threads: [] });
    }

    // Get all threads (shared inbox - same for everyone)
    const threads = await base44.entities.EmailThread.filter({
      is_deleted: { $ne: true }
    });

    return Response.json({ threads });
  } catch (error) {
    console.error('Get threads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});