import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mentioned_user_emails, sender_name, job_id, job_number, message_preview } = await req.json();

    if (!mentioned_user_emails || !Array.isArray(mentioned_user_emails) || mentioned_user_emails.length === 0) {
      return Response.json({ error: 'mentioned_user_emails is required' }, { status: 400 });
    }

    // Get all notification devices for mentioned users
    const devices = await base44.asServiceRole.entities.NotificationDevice.filter({
      user_email: { $in: mentioned_user_emails }
    });

    if (devices.length === 0) {
      return Response.json({ success: true, message: 'No devices found for mentioned users' });
    }

    // Send notifications to all devices
    const notificationPromises = devices.map(device => 
      base44.asServiceRole.functions.invoke('sendPushNotification', {
        device_token: device.device_token,
        device_platform: device.platform,
        title: `${sender_name} mentioned you`,
        body: message_preview || 'in a chat message',
        data: {
          type: 'chat_mention',
          job_id: job_id,
          job_number: job_number
        }
      })
    );

    await Promise.all(notificationPromises);

    return Response.json({ 
      success: true, 
      notifications_sent: devices.length 
    });
  } catch (error) {
    console.error('Error sending chat mention notifications:', error);
    return Response.json({ 
      error: error.message || 'Failed to send notifications' 
    }, { status: 500 });
  }
});