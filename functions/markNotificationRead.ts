import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationId, markAllRead } = await req.json();

    if (markAllRead) {
      // Mark all unread notifications as read
      const unreadNotifications = await base44.entities.Notification.filter({
        user_email: user.email,
        is_read: false
      });

      await Promise.all(
        unreadNotifications.map(n =>
          base44.entities.Notification.update(n.id, {
            is_read: true,
            read_at: new Date().toISOString()
          })
        )
      );

      return Response.json({ success: true, updated: unreadNotifications.length });
    } else if (notificationId) {
      // Mark single notification as read
      await base44.entities.Notification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    } else {
      return Response.json({ error: 'Missing notificationId or markAllRead' }, { status: 400 });
    }

  } catch (error) {
    console.error('markNotificationRead error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});