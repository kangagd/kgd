import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import webpush from 'npm:web-push@3.6.7';

// Initialize web-push with VAPID keys
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

    const { user_id, user_email, title, body, data, icon, url } = await req.json();

    if (!user_id && !user_email) {
      return Response.json({ error: 'user_id or user_email required' }, { status: 400 });
    }

    // Find active push subscriptions for the target user
    let subscriptions = [];
    if (user_id) {
      subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({ 
        user_id: user_id, 
        active: true 
      });
    } else if (user_email) {
      subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({ 
        user_email: user_email, 
        active: true 
      });
    }

    console.log(`[Push] Found ${subscriptions.length} active subscriptions for user ${user_id || user_email}`);

    if (subscriptions.length === 0) {
      console.log(`[Push] No active subscriptions found for user ${user_id || user_email}`);
      return Response.json({ 
        success: true, 
        sent: 0, 
        message: 'No active subscriptions found' 
      });
    }

    const payload = JSON.stringify({
      title: title || 'Notification',
      body: body || '',
      icon: icon || '/icon-192.png',
      data: {
        url: url || '/',
        ...data
      }
    });

    const results = [];
    for (const sub of subscriptions) {
      try {
        if (sub.platform === 'web' && sub.subscription_json) {
          const pushSubscription = JSON.parse(sub.subscription_json);
          
          await webpush.sendNotification(pushSubscription, payload);
          
          console.log(`[Push] SUCCESS: Sent to subscription ${sub.id} (${sub.platform})`);
          results.push({ id: sub.id, success: true });

          // Update last_seen
          await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
            last_seen: new Date().toISOString()
          });
        } else if (sub.token) {
          // For FCM tokens (mobile apps) - placeholder for future implementation
          console.log(`[Push] SKIP: FCM not implemented for subscription ${sub.id}`);
          results.push({ id: sub.id, success: false, reason: 'FCM not implemented' });
        }
      } catch (error) {
        console.error(`[Push] FAILED: Subscription ${sub.id}:`, error.message);
        results.push({ id: sub.id, success: false, error: error.message });

        // If subscription is expired or invalid, mark it inactive
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push] Marking subscription ${sub.id} as inactive (expired/invalid)`);
          await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
            active: false
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Push] Completed: ${successCount}/${results.length} notifications sent`);

    return Response.json({
      success: true,
      sent: successCount,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('[Push] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});