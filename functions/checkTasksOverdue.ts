import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all non-completed, non-archived tasks with due dates
    const allTasks = await base44.asServiceRole.entities.Task.list();
    
    const now = new Date();
    const overdueTasks = allTasks.filter(task => 
      task.due_date &&
      task.status !== 'completed' &&
      task.status !== 'archived' &&
      new Date(task.due_date) < now
    );

    // Get all existing "task overdue" notifications from today to avoid duplicates
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const existingOverdueNotifications = await base44.asServiceRole.entities.Notification.filter({
      type: 'warning',
      related_entity_type: 'Task',
      created_date: { $gte: todayStart.toISOString() }
    });

    const notifiedTaskIds = new Set(
      existingOverdueNotifications.map(n => n.related_entity_id)
    );

    // Create notifications for newly overdue tasks
    const newNotifications = overdueTasks
      .filter(task => !notifiedTaskIds.has(task.id) && task.assigned_to)
      .map(task => ({
        user_email: task.assigned_to,
        title: 'Task Overdue',
        body: `"${task.title}" is overdue (was due ${new Date(task.due_date).toLocaleDateString('en-AU')})`,
        type: 'warning',
        related_entity_type: 'Task',
        related_entity_id: task.id,
        is_read: false
      }));

    if (newNotifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(newNotifications);
    }

    return Response.json({ 
      success: true, 
      tasks_checked: allTasks.length,
      overdue_tasks_found: overdueTasks.length,
      new_notifications_created: newNotifications.length
    });

  } catch (error) {
    console.error('Task overdue check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});