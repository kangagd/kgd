import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;

    if (!data || !data.technician_email) {
      return Response.json({ error: 'Invalid check-in/out data' }, { status: 400 });
    }

    // Get all admins and managers for notification
    const allUsers = await base44.asServiceRole.entities.User.list();
    const notifyUsers = allUsers.filter(u => 
      u.role === 'admin' || u.extended_role === 'manager'
    );

    if (notifyUsers.length === 0) {
      return Response.json({ success: true, notifications_sent: 0 });
    }

    // Create notification for each admin/manager
    const notifications = notifyUsers.map(user => ({
      user_email: user.email,
      title: event.type === 'create' ? 'Technician Checked In' : 'Technician Checked Out',
      body: `${data.technician_name || data.technician_email} checked ${event.type === 'create' ? 'in' : 'out'} at ${new Date(data.check_in_time || data.check_out_time).toLocaleString('en-AU')}`,
      type: 'info',
      related_entity_type: 'CheckInOut',
      related_entity_id: data.id,
      is_read: false
    }));

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    return Response.json({ 
      success: true, 
      notifications_sent: notifications.length 
    });

  } catch (error) {
    console.error('CheckInOut notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});