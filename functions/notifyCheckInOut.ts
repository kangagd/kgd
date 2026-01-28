import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

console.log("[DEPLOY_SENTINEL] notifyCheckInOut_v20260129 v=2026-01-29");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { job_id, event_type, technician_email, check_in_time, check_out_time, duration_hours } = body;

    if (!job_id || !event_type || !technician_email) {
      return Response.json({ error: 'job_id, event_type, and technician_email are required' }, { status: 400 });
    }

    // Fetch job details
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch customer/project details for context
    let context = '';
    if (job.customer_name) {
      context = ` for ${job.customer_name}`;
    }
    if (job.project_name) {
      context = ` (${job.project_name})`;
    }

    let title = '';
    let body_text = '';

    if (event_type === 'check_in') {
      title = `Technician checked in`;
      body_text = `${technician_email} checked in to job #${job.job_number}${context}`;
    } else if (event_type === 'check_out') {
      title = `Technician checked out`;
      body_text = `${technician_email} checked out from job #${job.job_number}${context}. Duration: ${duration_hours?.toFixed(1) || 0} hours`;
    }

    // Get office/manager users for notifications
    const allUsers = await base44.asServiceRole.entities.User.list();
    const managers = allUsers.filter(u => u.role === 'admin' || u.extended_role === 'manager');

    // Create notifications for office/managers
    const notifications = [];
    for (const manager of managers) {
      const notif = await base44.asServiceRole.entities.Notification.create({
        user_email: manager.email,
        title,
        body: body_text,
        type: 'check_in_out',
        related_entity_type: 'Job',
        related_entity_id: job_id
      });
      notifications.push(notif);
    }

    console.log(`[notifyCheckInOut] Created ${notifications.length} notifications for ${event_type} event on job ${job_id}`);

    return Response.json({
      success: true,
      notifications_created: notifications.length
    });

  } catch (error) {
    console.error('notifyCheckInOut error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});