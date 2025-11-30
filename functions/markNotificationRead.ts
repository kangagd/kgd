import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications as read for this user
      const unreadNotifications = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id,
        is_read: false
      });

      const now = new Date().toISOString();
      await Promise.all(
        unreadNotifications.map(n => 
          base44.asServiceRole.entities.Notification.update(n.id, {
            is_read: true,
            read_at: now
          })
        )
      );

      return Response.json({ 
        success: true, 
        marked_count: unreadNotifications.length 
      });
    }

    if (!notificationId) {
      return Response.json({ error: 'notificationId or markAllRead required' }, { status: 400 });
    }

    // Verify notification belongs to user
    const notification = await base44.asServiceRole.entities.Notification.get(notificationId);
    
    if (!notification) {
      return Response.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (notification.user_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mark as read
    await base44.asServiceRole.entities.Notification.update(notificationId, {
      is_read: true,
      read_at: new Date().toISOString()
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});