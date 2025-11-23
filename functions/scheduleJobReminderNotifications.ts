import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

    // Find jobs starting in 10-15 minutes
    const allJobs = await base44.asServiceRole.entities.Job.list();
    
    const upcomingJobs = allJobs.filter(job => {
      if (!job.scheduled_date || !job.scheduled_time || !job.assigned_to) return false;
      
      const scheduledDateTime = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
      return scheduledDateTime >= tenMinutesFromNow && scheduledDateTime <= fifteenMinutesFromNow;
    });

    console.log(`Found ${upcomingJobs.length} jobs starting in 10-15 minutes`);

    for (const job of upcomingJobs) {
      const assignedEmails = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
      
      for (const techEmail of assignedEmails) {
        // Check if reminder already sent
        const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
          user_email: techEmail,
          type: 'job_start_reminder',
          'metadata.job_id': job.id
        });

        if (existingNotifications.length > 0) continue;

        // Get technician's preferences
        const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
          user_email: techEmail
        });

        if (prefs.length === 0 || !prefs[0].job_start_reminder) continue;

        // Get user ID
        const users = await base44.asServiceRole.entities.User.filter({ email: techEmail });
        if (users.length === 0) continue;

        const user = users[0];

        // Send reminder
        await fetch(`${Deno.env.get('BASE44_FUNCTION_URL')}/sendPushNotification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization')
          },
          body: JSON.stringify({
            user_id: user.id,
            title: 'Job Starting Soon',
            body: `Job #${job.job_number} at ${job.address} starts at ${job.scheduled_time}`,
            type: 'job_start_reminder',
            metadata: {
              job_id: job.id,
              job_number: job.job_number,
              scheduled_time: job.scheduled_time
            }
          })
        });

        console.log(`Sent reminder to ${techEmail} for job #${job.job_number}`);
      }
    }

    return Response.json({ 
      success: true, 
      jobs_processed: upcomingJobs.length 
    });
  } catch (error) {
    console.error('Error in reminder notifications:', error);
    return Response.json({ 
      error: 'Failed to process reminders', 
      details: error.message 
    }, { status: 500 });
  }
});