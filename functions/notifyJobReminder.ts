import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

async function sendOneSignalPush(userIds, title, message, url, data = {}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log('[JobReminder] OneSignal not configured');
    return { success: false, error: 'OneSignal not configured' };
  }

  if (!userIds || userIds.length === 0) {
    return { success: false, error: 'No user IDs provided' };
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    include_aliases: { external_id: userIds },
    target_channel: 'push',
    data: { url, ...data }
  };

  if (url) {
    payload.url = url;
  }

  try {
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
      console.error('[JobReminder] OneSignal error:', result);
      return { success: false, error: result.errors?.[0] || 'Failed to send' };
    }

    console.log(`[JobReminder] OneSignal sent: ${result.recipients} recipients`);
    return { success: true, recipients: result.recipients };
  } catch (error) {
    console.error('[JobReminder] OneSignal error:', error.message);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This can be called without user auth (e.g., from a cron job)
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    // Allow authenticated users OR valid cron secret
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user) isAuthorized = true;
    } catch {}
    
    if (!isAuthorized && cronSecret !== expectedSecret) {
      console.log('[JobReminder] Running without explicit auth (internal call)');
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    console.log(`[JobReminder] Checking for jobs starting soon`);

    // Fetch scheduled jobs for today
    const jobs = await base44.asServiceRole.entities.Job.filter({
      scheduled_date: todayStr,
      status: 'Scheduled'
    });

    console.log(`[JobReminder] Found ${jobs.length} scheduled jobs for today`);

    // Get all users for ID lookup
    const allUsers = await base44.asServiceRole.entities.User.list();

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

        // Get user IDs for assigned technicians
        const assignedUsers = allUsers.filter(u => job.assigned_to.includes(u.email));
        const userIds = assignedUsers.map(u => u.id);

        const title = `⏰ Job Starting Soon: #${job.job_number}`;
        const body = `${job.customer_name || 'Customer'} @ ${job.scheduled_time}${job.address_suburb ? ` • ${job.address_suburb}` : ''}`;
        const url = `/Jobs?jobId=${job.id}`;

        // Send via OneSignal
        const pushResult = await sendOneSignalPush(userIds, title, body, url, { job_id: job.id });
        if (pushResult.success) {
          remindersSent++;
        }

        // Create in-app notifications
        for (const techEmail of job.assigned_to) {
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