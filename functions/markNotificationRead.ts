import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications for this user as read
      await base44.entities.Notification.filter(
        { user_email: user.email, is_read: false }
      ).then(notifications => {
        return Promise.all(
          notifications.map(n => 
            base44.entities.Notification.update(n.id, { 
              is_read: true,
              read_at: new Date().toISOString()
            })
          )
        );
      });
    } else if (notificationId) {
      // Mark single notification as read
      await base44.entities.Notification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
    } else {
      return Response.json({ error: 'notificationId or markAllRead is required' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('markNotificationRead error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});