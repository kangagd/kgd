import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { device_type, push_token } = await req.json();

    if (!device_type || !push_token) {
      return Response.json({ error: 'device_type and push_token are required' }, { status: 400 });
    }

    // Check if device already exists
    const existingDevices = await base44.asServiceRole.entities.NotificationDevice.filter({
      user_id: user.id,
      push_token
    });

    let device;
    if (existingDevices.length > 0) {
      // Update existing device
      device = await base44.asServiceRole.entities.NotificationDevice.update(existingDevices[0].id, {
        is_active: true,
        last_seen_at: new Date().toISOString(),
        device_type
      });
    } else {
      // Create new device
      device = await base44.asServiceRole.entities.NotificationDevice.create({
        user_id: user.id,
        user_email: user.email,
        device_type,
        push_token,
        is_active: true,
        last_seen_at: new Date().toISOString()
      });
    }

    // Create default notification preferences if they don't exist
    const existingPrefs = await base44.asServiceRole.entities.NotificationPreference.filter({
      user_id: user.id
    });

    if (existingPrefs.length === 0) {
      const isAdmin = user.role === 'admin';
      await base44.asServiceRole.entities.NotificationPreference.create({
        user_id: user.id,
        user_email: user.email,
        role: user.role,
        job_assigned: true,
        job_start_reminder: true,
        overlap_warning: isAdmin,
        job_overdue: isAdmin,
        check_in_out: isAdmin
      });
    }

    return Response.json({ success: true, device });
  } catch (error) {
    console.error('Error registering device:', error);
    return Response.json({ 
      error: 'Failed to register device', 
      details: error.message 
    }, { status: 500 });
  }
});