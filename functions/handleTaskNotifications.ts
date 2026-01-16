import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    if (!data) {
      return Response.json({ error: 'Invalid task data' }, { status: 400 });
    }

    const notifications = [];

    // Check if task was just assigned
    const wasAssigned = event.type === 'create' || 
      (event.type === 'update' && old_data && !old_data.assigned_to_email && data.assigned_to_email);

    if (wasAssigned && data.assigned_to_email) {
      notifications.push({
        user_email: data.assigned_to_email,
        title: 'Task Assigned to You',
        body: `"${data.title}" has been assigned to you${data.due_date ? ` - Due: ${new Date(data.due_date).toLocaleDateString('en-AU')}` : ''}`,
        type: 'task',
        related_entity_type: 'Task',
        related_entity_id: data.id,
        is_read: false
      });
    }

    // Check if task became overdue (only on update)
    if (event.type === 'update' && data.due_date && data.status !== 'Completed' && data.status !== 'Cancelled') {
      const dueDate = new Date(data.due_date);
      const now = new Date();
      
      const wasNotOverdue = old_data && old_data.due_date && new Date(old_data.due_date) > now;
      const isNowOverdue = dueDate < now;

      if (wasNotOverdue && isNowOverdue && data.assigned_to_email) {
        notifications.push({
          user_email: data.assigned_to_email,
          title: 'Task Overdue',
          body: `"${data.title}" is now overdue (was due ${dueDate.toLocaleDateString('en-AU')})`,
          type: 'warning',
          related_entity_type: 'Task',
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
    console.error('Task notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});