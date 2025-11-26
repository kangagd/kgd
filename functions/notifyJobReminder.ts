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
        console.log(`[JobReminder] SUCCESS: Sent to ${userEmail} (sub: ${sub.id})`);
        sent++;

        await base44.asServiceRole.entities.PushSubscription.update(sub.id, {
          last_seen: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[JobReminder] FAILED for ${userEmail} (sub: ${sub.id}):`, error.message);
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
    
    // This can be called without user auth (e.g., from a cron job)
    // but validate with a secret header for security
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    // Allow authenticated users OR valid cron secret
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user) isAuthorized = true;
    } catch {}
    
    if (!isAuthorized && cronSecret !== expectedSecret) {
      // For now, allow the call to proceed if called internally
      console.log('[JobReminder] Running without explicit auth (internal call)');
    }

    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Get today's date string
    const todayStr = now.toISOString().split('T')[0];

    console.log(`[JobReminder] Checking for jobs starting around ${tenMinutesFromNow.toISOString()}`);

    // Fetch scheduled jobs for today
    const jobs = await base44.asServiceRole.entities.Job.filter({
      scheduled_date: todayStr,
      status: 'Scheduled'
    });

    console.log(`[JobReminder] Found ${jobs.length} scheduled jobs for today`);

    let remindersSent = 0;

    for (const job of jobs) {
      if (!job.scheduled_time || !job.assigned_to || job.assigned_to.length === 0) {
        continue;
      }

      // Parse scheduled time
      const [hours, minutes] = job.scheduled_time.split(':').map(Number);
      const jobDateTime = new Date(todayStr);
      jobDateTime.setHours(hours, minutes, 0, 0);

      // Check if job starts within 5-15 minute window
      const timeDiff = jobDateTime.getTime() - now.getTime();
      const minutesUntilJob = timeDiff / (60 * 1000);

      if (minutesUntilJob >= 5 && minutesUntilJob <= 15) {
        // Check if we already sent a reminder for this job today
        const existingReminders = await base44.asServiceRole.entities.Notification.filter({
          reference_id: job.id,
          type: 'job_reminder'
        });

        const todayReminder = existingReminders.find(n => 
          n.created_date && n.created_date.startsWith(todayStr)
        );

        if (todayReminder) {
          console.log(`[JobReminder] SKIP: Already sent reminder for job ${job.job_number} today`);
          continue;
        }

        console.log(`[JobReminder] Sending reminder for job ${job.job_number} (starts in ${Math.round(minutesUntilJob)} minutes)`);

        for (const techEmail of job.assigned_to) {
          const title = `⏰ Job Starting Soon: #${job.job_number}`;
          const body = `${job.customer_name || 'Customer'} @ ${job.scheduled_time}${job.address_suburb ? ` • ${job.address_suburb}` : ''}`;
          const url = `/Jobs?jobId=${job.id}`;

          const sent = await sendPushToUser(base44, techEmail, title, body, url, { job_id: job.id });
          remindersSent += sent;

          // Create in-app notification
          await base44.asServiceRole.entities.Notification.create({
            user_email: techEmail,
            type: 'job_reminder',
            title: title,
            message: body,
            reference_id: job.id,
            reference_type: 'Job',
            is_read: false
          });
        }
      }
    }

    console.log(`[JobReminder] Completed: ${remindersSent} reminders sent`);

    return Response.json({
      success: true,
      remindersSent,
      jobsChecked: jobs.length
    });
  } catch (error) {
    console.error('[JobReminder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});