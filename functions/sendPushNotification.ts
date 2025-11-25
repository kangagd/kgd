import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { user_id, title, body, type, metadata = {} } = await req.json();

    if (!user_id || !title || !body || !type) {
      return Response.json({ error: 'user_id, title, body, and type are required' }, { status: 400 });
    }

    // Get user details
    const user = await base44.asServiceRole.entities.User.get(user_id);

    // Create notification record
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_id,
      user_email: user.email,
      type,
      title,
      body,
      metadata
    });

    // Find all active devices for this user
    const devices = await base44.asServiceRole.entities.NotificationDevice.filter({
      user_id,
      is_active: true
    });

    // Configure web-push with VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return Response.json({ 
        success: true, 
        notification,
        devices_notified: 0,
        warning: 'VAPID keys not configured'
      });
    }

    webpush.setVapidDetails(
      'mailto:admin@kangaroogd.com.au',
      vapidPublicKey,
      vapidPrivateKey
    );

    // Send push notifications to all active devices
    let successCount = 0;
    let failedDevices = [];

    for (const device of devices) {
      if (device.device_type === 'web' && device.push_token) {
        try {
          const subscription = JSON.parse(device.push_token);
          await webpush.sendNotification(subscription, JSON.stringify({
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            data: { type, ...metadata }
          }));
          successCount++;
        } catch (pushError) {
          console.error(`Failed to send to device ${device.id}:`, pushError.message);
          failedDevices.push(device.id);
          
          // If subscription is invalid, mark device as inactive
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            await base44.asServiceRole.entities.NotificationDevice.update(device.id, {
              is_active: false
            });
          }
        }
      }
    }

    console.log(`Sent push notification to ${successCount}/${devices.length} devices for user ${user.email}`);

    return Response.json({ 
      success: true, 
      notification,
      devices_notified: successCount,
      failed_devices: failedDevices.length
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return Response.json({ 
      error: 'Failed to send notification', 
      details: error.message 
    }, { status: 500 });
  }
});