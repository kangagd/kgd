import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Defensive: no user → 401 with safe payload
    if (!user || !user.email) {
      return Response.json({ 
        success: false, 
        notifications: [], 
        unreadCount: 0,
        error: 'Unauthorized',
        error_code: 'no_user'
      }, { status: 401 });
    }

    const { limit = 50, only_unread = false } = await req.json().catch(() => ({}));

    // Build filter query
    const filterQuery = { user_email: user.email };
    if (only_unread) {
      filterQuery.is_read = false;
    }

    // Fetch user's notifications - catch DB failures
    let notifications = [];
    try {
      notifications = await base44.entities.Notification.filter(
        filterQuery,
        '-created_date',
        limit
      );
      
      // Defensive: ensure we got an array
      if (!Array.isArray(notifications)) {
        notifications = [];
      }
    } catch (dbError) {
      console.error("[getNotifications] DB query failed", { 
        user: user?.email, 
        error: String(dbError?.message || dbError) 
      });
      
      // Return 200 with safe empty state - do not fail the request
      return Response.json({
        success: false,
        notifications: [],
        unreadCount: 0,
        error: 'notifications_unavailable',
        error_code: 'notifications_fetch_failed'
      }, { status: 200 });
    }

    // Count unread
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return Response.json({
      success: true,
      notifications,
      unreadCount
    });

  } catch (error) {
    console.error("[getNotifications] Unexpected error", { error: String(error?.message || error) });
    
    // Never 500 - always return safe payload
    return Response.json({ 
      success: false,
      notifications: [], 
      unreadCount: 0,
      error: 'notifications_unavailable',
      error_code: 'unexpected_error'
    }, { status: 200 });
  }
});