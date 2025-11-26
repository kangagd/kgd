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

  console.log(`[JobAssign] Found ${subscriptions.length} subscriptions for ${userEmail}`);

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
        console.log(`[JobAssign] SUCCESS: Sent to ${userEmail} (sub: ${sub.id})`);
        sent++;

        await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
          last_seen: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[JobAssign] FAILED for ${userEmail} (sub: ${sub.id}):`, error.message);
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

    const { job_id, assigned_to_emails, job_number, customer_name, scheduled_date, scheduled_time, address } = await req.json();

    if (!job_id || !assigned_to_emails || assigned_to_emails.length === 0) {
      return Response.json({ error: 'job_id and assigned_to_emails required' }, { status: 400 });
    }

    console.log(`[JobAssign] Processing job ${job_id} assignment to ${assigned_to_emails.join(', ')}`);

    // Check if we've already sent notifications for this assignment
    // Using a simple approach: check Notification entity for recent duplicates
    const recentNotifications = await base44.asServiceRole.entities.Notification.filter({
      reference_id: job_id,
      type: 'job_assignment'
    });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentlySent = recentNotifications.filter(n => n.created_date > fiveMinutesAgo);

    if (recentlySent.length > 0) {
      console.log(`[JobAssign] SKIP: Already sent notification for job ${job_id} within last 5 minutes`);
      return Response.json({ 
        success: true, 
        skipped: true, 
        message: 'Notification already sent recently' 
      });
    }

    let totalSent = 0;
    const dateStr = scheduled_date ? new Date(scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const timeStr = scheduled_time || '';

    for (const email of assigned_to_emails) {
      const title = `New Job Assigned: #${job_number || 'N/A'}`;
      const body = `${customer_name || 'Customer'}${dateStr ? ` • ${dateStr}` : ''}${timeStr ? ` @ ${timeStr}` : ''}`;
      const url = `/Jobs?jobId=${job_id}`;

      const sent = await sendPushToUser(base44, email, title, body, url, { job_id });
      totalSent += sent;

      // Create in-app notification record
      await base44.asServiceRole.entities.Notification.create({
        user_email: email,
        type: 'job_assignment',
        title: title,
        message: body,
        reference_id: job_id,
        reference_type: 'Job',
        is_read: false
      });
    }

    console.log(`[JobAssign] Completed: ${totalSent} push notifications sent for job ${job_id}`);

    return Response.json({
      success: true,
      sent: totalSent,
      recipients: assigned_to_emails.length
    });
  } catch (error) {
    console.error('[JobAssign] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});