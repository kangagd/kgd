import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Send push notification via OneSignal REST API
 * 
 * Parameters:
 * - title: Notification title
 * - message: Notification body
 * - userIds: Array of external user IDs (your app's user IDs)
 * - playerIds: Array of OneSignal player IDs (alternative to userIds)
 * - url: URL to open when notification is clicked (optional)
 * - data: Additional data to send with notification (optional)
 * - segment: Send to a segment instead of specific users (optional)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, message, userIds, playerIds, url, data, segment } = await req.json();

    if (!title || !message) {
      return Response.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const appId = Deno.env.get('ONESIGNAL_APP_ID') || '50b86e27-3335-48dc-877c-4e4f3d223620';
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!appId || !apiKey) {
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Build notification payload
    const notificationPayload = {
      app_id: appId,
      headings: { en: title },
      contents: { en: message },
    };

    // Target users
    if (userIds && userIds.length > 0) {
      // Use external user IDs (your app's user IDs)
      notificationPayload.include_aliases = {
        external_id: userIds
      };
      notificationPayload.target_channel = 'push';
    } else if (playerIds && playerIds.length > 0) {
      // Use OneSignal player IDs
      notificationPayload.include_player_ids = playerIds;
    } else if (segment) {
      // Send to a segment
      notificationPayload.included_segments = [segment];
    } else {
      return Response.json({ 
        error: 'Must specify userIds, playerIds, or segment' 
      }, { status: 400 });
    }

    // Add optional URL
    if (url) {
      notificationPayload.url = url;
    }

    // Add optional data
    if (data) {
      notificationPayload.data = data;
    }

    // Send notification via OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(notificationPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('OneSignal API error:', result);
      return Response.json({ 
        success: false, 
        error: result.errors?.[0] || 'Failed to send notification' 
      }, { status: response.status });
    }

    return Response.json({ 
      success: true, 
      message: 'Notification sent',
      notificationId: result.id,
      recipients: result.recipients
    });
  } catch (error) {
    console.error('Error sending OneSignal notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});