import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all jobs as service role to bypass RLS restrictions
        const allJobs = await base44.asServiceRole.entities.Job.list({ limit: 1000 }); 

        const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
        const isTechnician = user.is_field_technician === true;

        if (isAdminOrManager) {
            return Response.json(allJobs);
        }

        // For technicians and other users, filter by assignment or creation
        // Case-insensitive matching for robustness
        const userEmail = user.email.toLowerCase().trim();
        
        const myJobs = allJobs.filter(job => {
            // Allow if user created the job
            if (job.created_by && job.created_by.toLowerCase() === userEmail) return true;

            // Allow if user is assigned to the job
            if (job.assigned_to) {
                if (Array.isArray(job.assigned_to)) {
                    return job.assigned_to.some(email => email && email.toLowerCase().trim() === userEmail);
                } else if (typeof job.assigned_to === 'string') {
                    return job.assigned_to.toLowerCase().trim() === userEmail;
                }
            }
            
            // Technicians might need to see ALL jobs if configured so, but usually strictly assigned.
            // If we want to replicate "view all jobs" for technicians (like in the previous RLS attempt), uncomment below:
            // if (isTechnician) return true;
            
            return false;
        });

        return Response.json(myJobs);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});