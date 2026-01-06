import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit = 50 } = await req.json().catch(() => ({}));

    // Fetch user's notifications
    const notifications = await base44.entities.Notification.filter(
      { user_email: user.email },
      '-created_date',
      limit
    );

    // Count unread
    const unread_count = notifications.filter(n => !n.is_read).length;

    return Response.json({
      notifications,
      unread_count
    });

  } catch (error) {
    console.error('getNotifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});