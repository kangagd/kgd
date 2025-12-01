import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all jobs scheduled for today
    const today = new Date().toISOString().split('T')[0];
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      scheduled_date: today,
      status: { $in: ['Scheduled', 'Open'] }
    });

    // Get all active check-ins (technicians currently at jobs)
    const activeCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({});
    const activeCheckInsMap = {};
    activeCheckIns.forEach(checkIn => {
      if (checkIn.check_in_time && !checkIn.check_out_time) {
        activeCheckInsMap[checkIn.technician_email] = checkIn;
      }
    });

    // Get all users for notification settings
    const allUsers = await base44.asServiceRole.entities.User.filter({});
    const usersMap = {};
    allUsers.forEach(user => {
      usersMap[user.email] = user;
    });

    const now = new Date();
    const notificationsCreated = [];

    for (const job of allJobs) {
      if (!job.scheduled_time || !job.assigned_to || job.assigned_to.length === 0) continue;

      // Parse scheduled time
      const [hours, minutes] = job.scheduled_time.split(':').map(Number);
      const jobStartTime = new Date(job.scheduled_date);
      jobStartTime.setHours(hours, minutes, 0, 0);

      const minutesUntilStart = (jobStartTime - now) / (1000 * 60);

      // Check if job starts in ~10 minutes (between 9 and 11 minutes to avoid duplicates)
      if (minutesUntilStart >= 9 && minutesUntilStart <= 11) {
        for (const techEmail of job.assigned_to) {
          const user = usersMap[techEmail];
          const settings = user?.notification_settings || {};
          
          // Check if user has opted out of job_starting_soon notifications
          if (settings.job_starting_soon === false) continue;

          const activeCheckIn = activeCheckInsMap[techEmail];
          
          if (activeCheckIn && activeCheckIn.job_id !== job.id) {
            // Technician is at another job - send "still at job" warning
            if (settings.technician_at_other_job === false) continue;

            await base44.asServiceRole.entities.Notification.create({
              user_email: techEmail,
              title: "Next job starting soon",
              body: `Job #${job.job_number} at ${job.address_suburb || job.address_full || 'scheduled location'} starts in 10 minutes. You're still checked in at another job.`,
              type: "warning",
              related_entity_type: "Job",
              related_entity_id: job.id,
              is_read: false
            });
            notificationsCreated.push({ type: 'at_other_job', techEmail, jobId: job.id });
          } else if (!activeCheckIn) {
            // Technician not checked in anywhere - send reminder
            await base44.asServiceRole.entities.Notification.create({
              user_email: techEmail,
              title: "Job starting in 10 minutes",
              body: `Job #${job.job_number} for ${job.customer_name || 'customer'} at ${job.address_suburb || job.address_full || 'scheduled location'} starts soon.`,
              type: "info",
              related_entity_type: "Job",
              related_entity_id: job.id,
              is_read: false
            });
            notificationsCreated.push({ type: 'starting_soon', techEmail, jobId: job.id });
          }
        }
      }
    }

    return Response.json({ 
      success: true, 
      notifications_created: notificationsCreated.length,
      details: notificationsCreated
    });

  } catch (error) {
    console.error('Error checking upcoming jobs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});