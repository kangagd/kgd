import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

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
        
        // GUARDRAIL: Prevent check-in to deleted jobs
        if (job.deleted_at) {
            return Response.json({ error: 'Cannot check in to deleted job' }, { status: 400 });
        }
        
        // GUARDRAIL: Prevent duplicate check-ins to same job
        const existingCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
            job_id: jobId,
            technician_email: user.email
        });
        const activeCheckInThisJob = existingCheckIns.find(c => !c.check_out_time);
        if (activeCheckInThisJob) {
            return Response.json({ 
                error: 'You already have an active check-in for this job',
                existing_check_in_id: activeCheckInThisJob.id
            }, { status: 400 });
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
            technician_name: user.display_name || user.full_name || user.email || "Unknown Technician",
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

        // Check if technician now has multiple active check-ins
        try {
            const allActiveCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
                technician_email: user.email
            });
            const multipleActive = allActiveCheckIns.filter(c => !c.check_out_time);

            if (multipleActive.length > 1) {
                // Create warning notification for technician
                await base44.asServiceRole.entities.Notification.create({
                    user_email: user.email,
                    title: 'Multiple Active Check-Ins',
                    body: `You are now checked in to ${multipleActive.length} jobs. Remember to check out when you leave each site.`,
                    type: 'warning',
                    related_entity_type: 'CheckInOut',
                    related_entity_id: checkIn.id,
                    is_read: false
                });
            }
        } catch (e) {
            console.error("Failed to check for multiple check-ins or create notification:", e);
            // Non-critical, don't fail the check-in
        }

        // 6.5. Ensure active Visit exists and check technician in (silent background creation)
        try {
            const { data: visitResult } = await base44.asServiceRole.functions.invoke('ensureActiveVisit', { job_id: jobId });
            
            if (visitResult?.visit) {
                const visit = visitResult.visit;
                
                // Check if already checked in to this visit
                const alreadyCheckedIn = (visit.checked_in_technicians || []).includes(user.email);
                
                if (!alreadyCheckedIn) {
                    const checkInEvent = {
                        technician_email: user.email,
                        technician_name: user.display_name || user.full_name || user.email,
                        checked_in_at: checkInTime,
                        checked_out_at: null
                    };
                    
                    await base44.asServiceRole.entities.Visit.update(visit.id, {
                        checked_in_technicians: [...(visit.checked_in_technicians || []), user.email],
                        checked_in_names: [...(visit.checked_in_names || []), user.display_name || user.full_name || user.email],
                        check_in_events: [...(visit.check_in_events || []), checkInEvent]
                    });
                }
            }
        } catch (e) {
            console.error("Failed to ensure active visit (non-critical):", e);
            // Don't block check-in if this fails
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

        // 8. Update project activity if job is linked to a project
        if (job.project_id) {
            await updateProjectActivity(base44, job.project_id, 'Visit Started');
        }

        return Response.json(checkIn);

    } catch (globalError) {
        console.error("CRITICAL ERROR in performCheckIn:", globalError);
        return Response.json({ 
            error: `Internal Server Error: ${globalError.message}` 
        }, { status: 500 });
    }
});