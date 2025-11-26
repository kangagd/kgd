import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

async function sendOneSignalPush(userIds, title, message, url, data = {}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log('[JobAssign] OneSignal not configured');
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
      console.error('[JobAssign] OneSignal error:', result);
      return { success: false, error: result.errors?.[0] || 'Failed to send' };
    }

    console.log(`[JobAssign] OneSignal sent: ${result.recipients} recipients`);
    return { success: true, recipients: result.recipients };
  } catch (error) {
    console.error('[JobAssign] OneSignal error:', error.message);
    return { success: false, error: error.message };
  }
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

    // Check for duplicate notifications (within last 5 minutes)
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

    // Get user IDs for assigned technicians
    const allUsers = await base44.asServiceRole.entities.User.list();
    const assignedUsers = allUsers.filter(u => assigned_to_emails.includes(u.email));
    const userIds = assignedUsers.map(u => u.id);

    const dateStr = scheduled_date ? new Date(scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const timeStr = scheduled_time || '';

    const title = `New Job Assigned: #${job_number || 'N/A'}`;
    const body = `${customer_name || 'Customer'}${dateStr ? ` • ${dateStr}` : ''}${timeStr ? ` @ ${timeStr}` : ''}`;
    const url = `/Jobs?jobId=${job_id}`;

    // Send via OneSignal
    const pushResult = await sendOneSignalPush(userIds, title, body, url, { job_id });

    // Create in-app notification records
    for (const email of assigned_to_emails) {
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

    console.log(`[JobAssign] Completed for job ${job_id}`);

    return Response.json({
      success: true,
      pushResult,
      recipients: assigned_to_emails.length
    });
  } catch (error) {
    console.error('[JobAssign] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});