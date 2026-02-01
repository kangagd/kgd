import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { parseISO, addMinutes } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId, assignedTo, scheduledDate, scheduledTime, expectedDuration } = await req.json();

        if (!assignedTo || !scheduledDate || !scheduledTime || !expectedDuration) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Parse candidate job time
        const candidateStartTimeStr = `${scheduledDate}T${scheduledTime}:00`;
        const candidateStart = parseISO(candidateStartTimeStr);
        const candidateEnd = addMinutes(candidateStart, expectedDuration * 60);

        // Fetch all non-completed jobs for this technician on this date
        const technicianJobs = await base44.asServiceRole.entities.Job.filter({
            assigned_to: assignedTo,
            scheduled_date: scheduledDate,
            status: { "$ne": "Completed" }
        });

        const conflicts = [];

        for (const job of technicianJobs) {
            if (job.id === jobId) continue;

            const existingStartTimeStr = `${job.scheduled_date}T${job.scheduled_time}:00`;
            const existingStart = parseISO(existingStartTimeStr);
            const existingEnd = addMinutes(existingStart, (job.expected_duration || 1) * 60);

            // Check for time overlap
            const hasOverlap = 
                (candidateStart < existingEnd && candidateEnd > existingStart);

            if (hasOverlap) {
                conflicts.push({
                    type: 'job',
                    id: job.id,
                    job_number: job.job_number,
                    customer_name: job.customer_name,
                    scheduled_time: job.scheduled_time,
                    expected_duration: job.expected_duration,
                    assigned_to_name: job.assigned_to_name
                });
            }
        }

        return Response.json({ conflicts });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});