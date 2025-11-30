import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const onlyUnread = url.searchParams.get('only_unread') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Build filter using user_id as per new schema
    const filter = { user_id: user.id };
    if (onlyUnread) {
      filter.is_read = false;
    }

    // Fetch notifications
    const notifications = await base44.asServiceRole.entities.Notification.filter(
      filter,
      '-created_date',
      limit
    );

    // Get unread count
    const unreadNotifications = await base44.asServiceRole.entities.Notification.filter(
      { user_id: user.id, is_read: false }
    );

    return Response.json({
      notifications,
      unread_count: unreadNotifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});