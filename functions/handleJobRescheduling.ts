import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    if (!data || event.type !== 'update' || !old_data) {
      return Response.json({ success: true }); // Only handle updates
    }

    const notifications = [];

    // Check if scheduled date or time changed
    const dateChanged = old_data.scheduled_date !== data.scheduled_date;
    const timeChanged = old_data.scheduled_time !== data.scheduled_time;

    if ((dateChanged || timeChanged) && data.assigned_to && data.assigned_to.length > 0) {
      const oldDateStr = old_data.scheduled_date ? new Date(old_data.scheduled_date).toLocaleDateString('en-AU') : 'unscheduled';
      const newDateStr = data.scheduled_date ? new Date(data.scheduled_date).toLocaleDateString('en-AU') : 'unscheduled';
      
      const oldTime = old_data.scheduled_time || '';
      const newTime = data.scheduled_time || '';

      // Notify each assigned technician
      for (const techEmail of data.assigned_to) {
        let changeDetails = '';
        if (dateChanged && timeChanged) {
          changeDetails = `from ${oldDateStr} ${oldTime} to ${newDateStr} ${newTime}`;
        } else if (dateChanged) {
          changeDetails = `from ${oldDateStr} to ${newDateStr}`;
        } else {
          changeDetails = `from ${oldTime} to ${newTime}`;
        }

        notifications.push({
          user_email: techEmail,
          title: 'Job Rescheduled',
          body: `Job #${data.job_number} at ${data.customer_name} has been rescheduled ${changeDetails}`,
          type: 'info',
          related_entity_type: 'Job',
          related_entity_id: data.id,
          is_read: false
        });
      }
    }

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ 
      success: true, 
      notifications_created: notifications.length 
    });

  } catch (error) {
    console.error('Job rescheduling notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});