import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

webpush.setVapidDetails(
  'mailto:admin@kangaroogd.com.au',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[TestPush] Sending test notification to ${user.email}`);

    // Get user's active subscriptions
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_email: user.email,
      active: true
    });

    console.log(`[TestPush] Found ${subscriptions.length} active subscriptions`);

    if (subscriptions.length === 0) {
      return Response.json({
        success: false,
        message: 'No active push subscriptions found. Please enable push notifications first.',
        subscriptionCount: 0
      });
    }

    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body: `This is a test push notification sent at ${new Date().toLocaleTimeString()}`,
      icon: '/icon-192.png',
      data: {
        url: '/UserProfile',
        test: true
      }
    });

    const results = [];

    for (const sub of subscriptions) {
      try {
        if (sub.platform === 'web' && sub.subscription_json) {
          const pushSubscription = JSON.parse(sub.subscription_json);
          
          await webpush.sendNotification(pushSubscription, payload);
          
          console.log(`[TestPush] SUCCESS: Sent to subscription ${sub.id}`);
          results.push({ 
            id: sub.id, 
            platform: sub.platform,
            success: true 
          });

          await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
            last_seen: new Date().toISOString()
          });
        } else {
          console.log(`[TestPush] SKIP: Non-web subscription ${sub.id}`);
          results.push({ 
            id: sub.id, 
            platform: sub.platform,
            success: false, 
            reason: 'Non-web subscription' 
          });
        }
      } catch (error) {
        console.error(`[TestPush] FAILED: Subscription ${sub.id}:`, error.message);
        results.push({ 
          id: sub.id, 
          platform: sub.platform,
          success: false, 
          error: error.message,
          statusCode: error.statusCode
        });

        // Mark expired subscriptions as inactive
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[TestPush] Marking subscription ${sub.id} as inactive`);
          await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
            active: false
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[TestPush] Completed: ${successCount}/${results.length} sent successfully`);

    return Response.json({
      success: successCount > 0,
      message: successCount > 0 
        ? `Test notification sent to ${successCount} device(s)` 
        : 'Failed to send to any devices',
      sent: successCount,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('[TestPush] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});