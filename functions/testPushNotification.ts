import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Send a test push notification via OneSignal REST API
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[TestPush] Sending test notification to user: ${user.id}, email: ${user.email}`);

    const appId = Deno.env.get('ONESIGNAL_APP_ID') || '50b86e27-3335-48dc-877c-4e4f3d223620';
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!appId || !apiKey) {
      console.error('[TestPush] OneSignal not configured');
      return Response.json({ 
        success: false, 
        message: 'OneSignal not configured. Please set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY.' 
      }, { status: 500 });
    }

    // Try sending to all subscribed users (for testing)
    const notificationPayload = {
      app_id: appId,
      headings: { en: '🔔 Test Notification' },
      contents: { en: `Test notification for ${user.full_name || user.email} at ${new Date().toLocaleTimeString()}` },
      included_segments: ['Subscribed Users']
    };

    console.log('[TestPush] Sending to OneSignal:', JSON.stringify(notificationPayload));

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
    console.log('[TestPush] OneSignal response:', JSON.stringify(result));

    if (!response.ok) {
      console.error('[TestPush] OneSignal API error:', result);
      return Response.json({ 
        success: false, 
        message: result.errors?.[0] || 'Failed to send notification',
        details: result
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Notification sent!',
      notificationId: result.id,
      recipients: result.recipients
    });
  } catch (error) {
    console.error('[TestPush] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});