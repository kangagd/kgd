import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all pending and sent reminders
    const reminders = await base44.asServiceRole.entities.MaintenanceReminder.list();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updatedCount = 0;
    let expiredWarrantiesCount = 0;

    // Check each reminder
    for (const reminder of reminders) {
      if (reminder.status === 'Completed' || reminder.status === 'Skipped') {
        continue;
      }

      const dueDate = new Date(reminder.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // Mark as overdue if due date has passed
      if (dueDate <= today && !reminder.is_overdue) {
        await base44.asServiceRole.entities.MaintenanceReminder.update(reminder.id, {
          is_overdue: true
        });
        updatedCount++;
      }
    }

    // Check and update warranty statuses
    const projects = await base44.asServiceRole.entities.Project.filter({
      warranty_status: 'Active'
    });

    for (const project of projects) {
      if (!project.warranty_end_date) continue;

      const endDate = new Date(project.warranty_end_date);
      endDate.setHours(0, 0, 0, 0);

      if (endDate < today) {
        await base44.asServiceRole.entities.Project.update(project.id, {
          warranty_status: 'Expired'
        });
        expiredWarrantiesCount++;
      }
    }

    return Response.json({
      success: true,
      reminders_checked: reminders.length,
      reminders_marked_overdue: updatedCount,
      warranties_expired: expiredWarrantiesCount,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking maintenance reminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});