import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const onlyUnread = url.searchParams.get('only_unread') === 'true';
    const requestedLimit = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const since = url.searchParams.get('since');

    // Build filter - always scope to current user
    const filter = { user_email: user.email };
    if (onlyUnread) {
      filter.is_read = false;
    }
    if (since) {
      filter.created_date = { $gte: since };
    }

    // Fetch notifications and unread count in parallel for better performance
    const [notifications, unreadNotifications] = await Promise.all([
      base44.asServiceRole.entities.Notification.filter(
        filter,
        '-created_date',
        limit
      ),
      // Only fetch unread count if we're not already filtering to unread
      onlyUnread 
        ? Promise.resolve([]) 
        : base44.asServiceRole.entities.Notification.filter(
            { user_email: user.email, is_read: false },
            'created_date',
            100 // Limit unread count query to prevent scanning all notifications
          )
    ]);

    // Calculate unread count efficiently
    const unreadCount = onlyUnread 
      ? notifications.length 
      : unreadNotifications.length;

    return Response.json({
      notifications,
      unread_count: unreadCount
    });
  } catch (error) {
    // Defensive error handling with backwards-compatible shape
    return Response.json({
      notifications: [],
      unread_count: 0,
      error: 'Failed to load notifications'
    }, { status: 500 });
  }
});