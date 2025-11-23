import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Get all active check-ins and jobs
    const [checkIns, allJobs, admins] = await Promise.all([
      base44.asServiceRole.entities.CheckInOut.filter({ check_out_time: { $exists: false } }),
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.User.filter({ role: 'admin' })
    ]);

    const overlapNotifications = [];
    const overdueNotifications = [];

    // Check for overlaps
    for (const checkIn of checkIns) {
      const technicianJobs = allJobs.filter(job => {
        const assignedEmails = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
        return assignedEmails.includes(checkIn.technician_email);
      });

      for (const job of technicianJobs) {
        if (job.id === checkIn.job_id) continue;
        if (!job.scheduled_date || !job.scheduled_time) continue;

        const scheduledDateTime = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
        const minutesUntilStart = (scheduledDateTime - now) / 60000;

        if (minutesUntilStart > 0 && minutesUntilStart <= 15) {
          overlapNotifications.push({
            technician: checkIn.technician_name,
            currentJobNumber: checkIn.job_id,
            upcomingJobNumber: job.job_number,
            minutesUntilStart: Math.round(minutesUntilStart)
          });
        }
      }
    }

    // Check for overdue jobs
    for (const job of allJobs) {
      if (job.status === 'Completed' || job.status === 'Cancelled') continue;
      if (!job.scheduled_date || !job.scheduled_time || !job.expected_duration) continue;

      const scheduledDateTime = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
      const expectedEndTime = new Date(scheduledDateTime.getTime() + job.expected_duration * 3600000);

      if (now > expectedEndTime) {
        const hoursOverdue = (now - expectedEndTime) / 3600000;
        overdueNotifications.push({
          job_number: job.job_number,
          address: job.address,
          hoursOverdue: Math.round(hoursOverdue * 10) / 10
        });
      }
    }

    // Send notifications to admins
    for (const admin of admins) {
      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
        user_id: admin.id
      });

      if (prefs.length === 0) continue;
      const pref = prefs[0];

      // Send overlap warnings
      if (pref.overlap_warning && overlapNotifications.length > 0) {
        for (const overlap of overlapNotifications) {
          await fetch(`${Deno.env.get('BASE44_FUNCTION_URL')}/sendPushNotification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization')
            },
            body: JSON.stringify({
              user_id: admin.id,
              title: 'Schedule Overlap Detected',
              body: `${overlap.technician} is checked in but has Job #${overlap.upcomingJobNumber} starting in ${overlap.minutesUntilStart} minutes`,
              type: 'overlap_warning',
              metadata: overlap
            })
          });
        }
      }

      // Send overdue alerts
      if (pref.job_overdue && overdueNotifications.length > 0) {
        for (const overdue of overdueNotifications) {
          // Check if already notified
          const existing = await base44.asServiceRole.entities.Notification.filter({
            user_id: admin.id,
            type: 'job_overdue',
            'metadata.job_number': overdue.job_number
          });

          if (existing.length > 0) continue;

          await fetch(`${Deno.env.get('BASE44_FUNCTION_URL')}/sendPushNotification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization')
            },
            body: JSON.stringify({
              user_id: admin.id,
              title: 'Job Overdue',
              body: `Job #${overdue.job_number} at ${overdue.address} is ${overdue.hoursOverdue}h overdue`,
              type: 'job_overdue',
              metadata: overdue
            })
          });
        }
      }
    }

    return Response.json({ 
      success: true, 
      overlaps: overlapNotifications.length,
      overdues: overdueNotifications.length
    });
  } catch (error) {
    console.error('Error checking overlaps/overdues:', error);
    return Response.json({ 
      error: 'Failed to check overlaps and overdues', 
      details: error.message 
    }, { status: 500 });
  }
});