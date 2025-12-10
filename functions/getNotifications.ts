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
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Build filter
    const filter = { user_email: user.email };
    if (onlyUnread) {
      filter.is_read = false;
    }

    // Fetch notifications
    const notifications = await base44.asServiceRole.entities.Notification.filter(
      filter,
      '-created_date',
      limit
    );

    // Calculate unread count from fetched notifications to avoid second query
    // For total unread count across all notifications (not just the limited set),
    // we need a separate query, but we can optimize by only fetching count-relevant fields
    const unreadNotifications = await base44.asServiceRole.entities.Notification.filter(
      { user_email: user.email, is_read: false },
      '-created_date',
      100 // Cap at 100 to avoid scanning entire table - show 99+ if needed
    );

    return Response.json({
      notifications,
      unread_count: Math.min(unreadNotifications.length, 99) // Cap display at 99+
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});