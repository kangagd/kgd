import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Parse jobId from request body
        const { jobId } = await req.json();
        if (!jobId) return Response.json({ error: 'Job ID required' }, { status: 400 });

        // Fetch job as service role to bypass RLS restrictions
        const job = await base44.asServiceRole.entities.Job.get(jobId); 
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
        const isTechnician = user.is_field_technician === true; 

        if (isAdminOrManager || isTechnician) {
            return Response.json(job);
        }

        // For technicians and other users, check permissions manually
        const userEmail = user.email.toLowerCase().trim();
        let hasAccess = false;

        // Check created_by
        if (job.created_by && job.created_by.toLowerCase() === userEmail) hasAccess = true;

        // Check assigned_to
        if (!hasAccess && job.assigned_to) {
            if (Array.isArray(job.assigned_to)) {
                hasAccess = job.assigned_to.some(email => email && email.toLowerCase().trim() === userEmail);
            } else if (typeof job.assigned_to === 'string') {
                hasAccess = job.assigned_to.toLowerCase().trim() === userEmail;
            }
        }

        if (!hasAccess) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Auto-sync address from project if missing
        if (!job.address_full || !job.address_full.trim()) {
            try {
                await base44.asServiceRole.functions.invoke('syncJobAddressFromProject', {
                    job_id: jobId
                });
                // Fetch updated job
                const updatedJob = await base44.asServiceRole.entities.Job.get(jobId);
                return Response.json(updatedJob);
            } catch (syncError) {
                console.error('Address sync failed:', syncError);
                // Still return job even if sync fails
                return Response.json(job);
            }
        }

        return Response.json(job);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});