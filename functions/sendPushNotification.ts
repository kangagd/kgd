import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // In a real implementation, you would send push notifications here
    // using services like Firebase Cloud Messaging, Apple Push Notification Service, etc.
    // For now, we'll just log that we would send notifications
    console.log(`Would send push notification to ${devices.length} devices for user ${user.email}`);
    console.log(`Title: ${title}, Body: ${body}`);

    return Response.json({ 
      success: true, 
      notification,
      devices_notified: devices.length 
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return Response.json({ 
      error: 'Failed to send notification', 
      details: error.message 
    }, { status: 500 });
  }
});