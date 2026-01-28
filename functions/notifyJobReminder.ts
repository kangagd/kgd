import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

console.log("[DEPLOY_SENTINEL] notifyJobReminder_v20260129 v=2026-01-29");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { job_id, scheduled_date, scheduled_time } = body;

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check idempotency: skip if reminder already sent today
    if (job.reminder_sent_at) {
      const reminderDate = new Date(job.reminder_sent_at).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      if (reminderDate === today) {
        console.log(`[notifyJobReminder] Reminder already sent for job ${job_id} today`);
        return Response.json({ success: true, skipped: true, reason: 'Reminder already sent today' });
      }
    }

    // Get assigned technicians
    const assignedEmails = job.assigned_to || [];
    if (assignedEmails.length === 0) {
      console.log(`[notifyJobReminder] No assigned technicians for job ${job_id}`);
      return Response.json({ success: true, notifications_created: 0 });
    }

    // Get office/manager users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const managers = allUsers.filter(u => u.role === 'admin' || u.extended_role === 'manager');

    // Build notification title/body
    const schedDate = scheduled_date || job.scheduled_date || 'TBD';
    const title = `Upcoming job #${job.job_number}`;
    const body_text = `Scheduled for ${schedDate} at ${scheduled_time || job.scheduled_time || 'TBD'} - ${job.customer_name || 'Customer'}`;

    // Create notifications for assigned technicians
    const notifications = [];
    for (const email of assignedEmails) {
      const notif = await base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title,
        body: body_text,
        type: 'job_reminder',
        related_entity_type: 'Job',
        related_entity_id: job_id
      });
      notifications.push(notif);
    }

    // Create notifications for office/managers
    for (const manager of managers) {
      const notif = await base44.asServiceRole.entities.Notification.create({
        user_email: manager.email,
        title,
        body: body_text,
        type: 'job_reminder',
        related_entity_type: 'Job',
        related_entity_id: job_id
      });
      notifications.push(notif);
    }

    // Mark reminder as sent (idempotency guard)
    await base44.asServiceRole.entities.Job.update(job_id, {
      reminder_sent_at: new Date().toISOString()
    });

    console.log(`[notifyJobReminder] Created ${notifications.length} reminders for job ${job_id}`);

    return Response.json({
      success: true,
      notifications_created: notifications.length
    });

  } catch (error) {
    console.error('notifyJobReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});