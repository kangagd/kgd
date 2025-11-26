import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

/**
 * Generic push notification function using OneSignal
 * 
 * Parameters:
 * - user_id: Single user ID to send to
 * - user_email: User email (will lookup user ID)
 * - user_ids: Array of user IDs to send to
 * - title: Notification title
 * - body: Notification message
 * - url: URL to open when clicked
 * - data: Additional data payload
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id, user_email, user_ids, title, body, url, data } = await req.json();

    if (!title || !body) {
      return Response.json({ error: 'title and body required' }, { status: 400 });
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Resolve user IDs
    let targetUserIds = [];

    if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else if (user_id) {
      targetUserIds = [user_id];
    } else if (user_email) {
      // Look up user ID from email
      const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
      if (users.length > 0) {
        targetUserIds = [users[0].id];
      }
    }

    if (targetUserIds.length === 0) {
      console.log(`[Push] No user IDs resolved`);
      return Response.json({ 
        success: true, 
        sent: 0, 
        message: 'No users found' 
      });
    }

    console.log(`[Push] Sending to ${targetUserIds.length} users via OneSignal`);

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: body },
      include_aliases: { external_id: targetUserIds },
      target_channel: 'push',
      data: { url: url || '/', ...data }
    };

    if (url) {
      payload.url = url;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Push] OneSignal error:', result);
      return Response.json({ 
        success: false, 
        error: result.errors?.[0] || 'Failed to send' 
      }, { status: response.status });
    }

    console.log(`[Push] Completed: ${result.recipients} recipients`);

    return Response.json({
      success: true,
      sent: result.recipients || 0,
      notificationId: result.id
    });
  } catch (error) {
    console.error('[Push] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});