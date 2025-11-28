import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        // 1. Initialize SDK
        const base44 = createClientFromRequest(req);
        
        // 2. Authentication
        let user;
        try {
            user = await base44.auth.me();
        } catch (e) {
            console.error("Auth check failed:", e);
            return Response.json({ error: 'Authentication check failed' }, { status: 401 });
        }
        
        if (!user) {
            console.error("No user found in session");
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Parse Request
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("Failed to parse JSON body:", e);
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { jobId, newStatus } = body;

        if (!jobId) {
            return Response.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // 4. Fetch Job
        let job;
        try {
            // Use user-scoped entity access since RLS allows technicians to read jobs
            job = await base44.entities.Job.get(jobId);
        } catch (e) {
            console.error(`Failed to fetch job ${jobId}:`, e);
            // Fallback to service role if user access fails (e.g. not assigned but needs access)
            try {
                job = await base44.asServiceRole.entities.Job.get(jobId);
            } catch (serviceError) {
                 return Response.json({ error: `Job retrieval failed: ${e.message}` }, { status: 404 });
            }
        }

        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // 5. Authorization Logic
        if (user.role !== 'admin' && user.role !== 'manager') {
            const userEmail = (user.email || "").toLowerCase().trim();
            let isAssigned = false;
            
            if (job.assigned_to) {
                if (Array.isArray(job.assigned_to)) {
                    isAssigned = job.assigned_to.some(email => email && email.toLowerCase().trim() === userEmail);
                } else if (typeof job.assigned_to === 'string') {
                    isAssigned = job.assigned_to.toLowerCase().trim() === userEmail;
                }
            }

            const isCreator = job.created_by && job.created_by.toLowerCase() === userEmail;
            const isTechnician = user.is_field_technician === true || user.is_field_technician === 'true';

            if (!isAssigned && !isCreator && !isTechnician) {
                 console.warn(`User ${userEmail} denied check-in to job ${jobId}`);
                 return Response.json({ error: 'Not authorized to check in to this job' }, { status: 403 });
            }
        }

        // 6. Create Check-in Record
        const checkInTime = new Date().toISOString();
        const checkInData = {
            job_id: jobId,
            technician_email: user.email || "unknown@example.com",
            technician_name: user.full_name || user.display_name || user.email || "Unknown Technician",
            check_in_time: checkInTime
        };

        console.log("Attempting to create CheckInOut record:", JSON.stringify(checkInData));

        let checkIn;
        try {
            // Use user-scoped entity access - RLS has been updated to allow this
            checkIn = await base44.entities.CheckInOut.create(checkInData);
        } catch (e) {
            console.error("Failed to create CheckInOut entity (user scope):", e);
            // Fallback to service role if user scope fails
             try {
                 console.log("Retrying with service role...");
                 checkIn = await base44.asServiceRole.entities.CheckInOut.create(checkInData);
             } catch (serviceError) {
                console.error("Failed to create CheckInOut entity (service role):", serviceError);
                return Response.json({ 
                    error: `Failed to create check-in record. DB Error: ${serviceError.message || JSON.stringify(serviceError)}` 
                }, { status: 500 });
             }
        }

        // 7. Update Job Status (Optional)
        if (newStatus && newStatus !== job.status) {
            try {
                await base44.entities.Job.update(jobId, { status: newStatus });
            } catch (e) {
                console.error("Failed to update job status (user scope):", e);
                 try {
                    await base44.asServiceRole.entities.Job.update(jobId, { status: newStatus });
                 } catch (serviceError) {
                     console.error("Failed to update job status (service role):", serviceError);
                 }
            }
        }

        return Response.json(checkIn);

    } catch (globalError) {
        console.error("CRITICAL ERROR in performCheckIn:", globalError);
        return Response.json({ 
            error: `Internal Server Error: ${globalError.message}` 
        }, { status: 500 });
    }
});