import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, newStatus } = await req.json();

        if (!jobId) {
            return Response.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // Verify job exists and user has access (basic check)
        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Case-insensitive check for assignment if not admin/manager
        if (user.role !== 'admin' && user.role !== 'manager') {
            const userEmail = user.email.toLowerCase().trim();
            let isAssigned = false;
            
            if (job.assigned_to) {
                if (Array.isArray(job.assigned_to)) {
                    isAssigned = job.assigned_to.some(email => email && email.toLowerCase().trim() === userEmail);
                } else if (typeof job.assigned_to === 'string') {
                    isAssigned = job.assigned_to.toLowerCase().trim() === userEmail;
                }
            }

            if (!isAssigned && (!job.created_by || job.created_by.toLowerCase() !== userEmail)) {
                 // Allow if user is field technician even if not strictly assigned
                 // This ensures technicians can always check in to jobs they can see
                 // Handle both boolean and string 'true' for robustness
                 const isTechnician = user.is_field_technician === true || user.is_field_technician === 'true';
                 
                 if (!isTechnician) {
                     return Response.json({ error: 'Not authorized to check in to this job' }, { status: 403 });
                 }
            }
        }

        // Perform Check In
        const checkInTime = new Date().toISOString();
        const checkIn = await base44.asServiceRole.entities.CheckInOut.create({
            job_id: jobId,
            technician_email: user.email,
            technician_name: user.full_name,
            check_in_time: checkInTime
        });

        // Update Job Status
        if (newStatus) {
            await base44.asServiceRole.entities.Job.update(jobId, { status: newStatus });
        }

        return Response.json(checkIn);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});