import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

async function sendOneSignalPush(userIds, title, message, url, data = {}) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.log('[CheckInOut] OneSignal not configured');
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
      console.error('[CheckInOut] OneSignal error:', result);
      return { success: false, error: result.errors?.[0] || 'Failed to send' };
    }

    console.log(`[CheckInOut] OneSignal sent: ${result.recipients} recipients`);
    return { success: true, recipients: result.recipients };
  } catch (error) {
    console.error('[CheckInOut] OneSignal error:', error.message);
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

    const isCheckIn = event_type === 'check_in';
    const title = isCheckIn 
      ? `✅ ${technician_name} checked in`
      : `🏁 ${technician_name} checked out`;
    
    const body = `Job #${job_number || 'N/A'}${customer_name ? ` • ${customer_name}` : ''}${notes ? ` • ${notes}` : ''}`;
    const url = job_id ? `/Jobs?jobId=${job_id}` : '/Schedule';

    // Filter admins based on notification preferences
    const adminsToNotify = [];
    for (const admin of adminUsers) {
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
        user_email: admin.email
      });
      
      const pref = prefs[0];
      const shouldSend = !pref || pref.tech_check_in_out !== false;
      
      if (shouldSend) {
        adminsToNotify.push(admin);
      } else {
        console.log(`[CheckInOut] SKIP: ${admin.email} has disabled check-in/out notifications`);
      }
    }

    // Get user IDs for admins to notify
    const userIds = adminsToNotify.map(u => u.id);

    // Send via OneSignal
    const pushResult = await sendOneSignalPush(userIds, title, body, url, { 
      job_id, 
      check_in_out_id,
      event_type 
    });

    // Create in-app notifications
    for (const admin of adminsToNotify) {
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

    console.log(`[CheckInOut] Completed`);

    return Response.json({
      success: true,
      pushResult,
      adminsNotified: adminsToNotify.length
    });
  } catch (error) {
    console.error('[CheckInOut] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});