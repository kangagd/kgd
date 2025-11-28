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
            job = await base44.asServiceRole.entities.Job.get(jobId);
        } catch (e) {
            console.error(`Failed to fetch job ${jobId}:`, e);
            return Response.json({ error: `Job retrieval failed: ${e.message}` }, { status: 404 });
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
            // Use service role to bypass RLS and ensure creation
            checkIn = await base44.asServiceRole.entities.CheckInOut.create(checkInData);
        } catch (e) {
            console.error("Failed to create CheckInOut entity:", e);
            // Try to provide detailed error
            return Response.json({ 
                error: `Failed to create check-in record. DB Error: ${e.message || JSON.stringify(e)}` 
            }, { status: 500 });
        }

        // 7. Update Job Status (Optional)
        if (newStatus && newStatus !== job.status) {
            try {
                await base44.asServiceRole.entities.Job.update(jobId, { status: newStatus });
            } catch (e) {
                console.error("Failed to update job status (non-fatal):", e);
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