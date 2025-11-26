import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

webpush.setVapidDetails(
  'mailto:admin@kangaroogd.com.au',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function sendPushToUser(base44, userEmail, title, body, url, data = {}) {
  const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
    user_email: userEmail,
    active: true
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      if (sub.platform === 'web' && sub.subscription_json) {
        const pushSubscription = JSON.parse(sub.subscription_json);
        const payload = JSON.stringify({
          title,
          body,
          icon: '/icon-192.png',
          data: { url, ...data }
        });

        await webpush.sendNotification(pushSubscription, payload);
        console.log(`[CheckInOut] SUCCESS: Sent to ${userEmail} (sub: ${sub.id})`);
        sent++;

        await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
          last_seen: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[CheckInOut] FAILED for ${userEmail} (sub: ${sub.id}):`, error.message);
      if (error.statusCode === 410 || error.statusCode === 404) {
        await base44.asServiceRole.entities.PushSubscription.update(sub.id, { active: false });
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      check_in_out_id, 
      event_type, // 'check_in' or 'check_out'
      technician_name, 
      technician_email,
      job_id, 
      job_number,
      customer_name,
      notes
    } = await req.json();

    if (!event_type || !technician_name) {
      return Response.json({ error: 'event_type and technician_name required' }, { status: 400 });
    }

    console.log(`[CheckInOut] Processing ${event_type} for ${technician_name} on job ${job_number}`);

    // Check for duplicate notifications (within last 2 minutes)
    const recentNotifications = await base44.asServiceRole.entities.Notification.filter({
      reference_id: check_in_out_id || job_id,
      type: `tech_${event_type}`
    });

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const recentlySent = recentNotifications.filter(n => n.created_date > twoMinutesAgo);

    if (recentlySent.length > 0) {
      console.log(`[CheckInOut] SKIP: Already sent ${event_type} notification recently`);
      return Response.json({ 
        success: true, 
        skipped: true, 
        message: 'Notification already sent recently' 
      });
    }

    // Get all admin users to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const adminUsers = allUsers.filter(u => u.role === 'admin' && u.email !== technician_email);

    console.log(`[CheckInOut] Notifying ${adminUsers.length} admins`);

    let totalSent = 0;

    const isCheckIn = event_type === 'check_in';
    const title = isCheckIn 
      ? `✅ ${technician_name} checked in`
      : `🏁 ${technician_name} checked out`;
    
    const body = `Job #${job_number || 'N/A'}${customer_name ? ` • ${customer_name}` : ''}${notes ? ` • ${notes}` : ''}`;
    const url = job_id ? `/Jobs?jobId=${job_id}` : '/Schedule';

    for (const admin of adminUsers) {
      // Check admin's notification preferences
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
        user_email: admin.email
      });
      
      const pref = prefs[0];
      
      // Default to sending if no preference set, or if preference allows
      const shouldSend = !pref || pref.tech_check_in_out !== false;
      
      if (!shouldSend) {
        console.log(`[CheckInOut] SKIP: ${admin.email} has disabled check-in/out notifications`);
        continue;
      }

      const sent = await sendPushToUser(base44, admin.email, title, body, url, { 
        job_id, 
        check_in_out_id,
        event_type 
      });
      totalSent += sent;

      // Create in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        type: `tech_${event_type}`,
        title: title,
        message: body,
        reference_id: check_in_out_id || job_id,
        reference_type: 'CheckInOut',
        is_read: false
      });
    }

    console.log(`[CheckInOut] Completed: ${totalSent} push notifications sent`);

    return Response.json({
      success: true,
      sent: totalSent,
      adminsNotified: adminUsers.length
    });
  } catch (error) {
    console.error('[CheckInOut] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});