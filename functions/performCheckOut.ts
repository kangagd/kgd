import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        let user;
        try {
            user = await base44.auth.me();
        } catch (e) {
            console.error("Auth error:", e);
            return Response.json({ error: 'Authentication failed' }, { status: 401 });
        }
        
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { 
            jobId, 
            checkInId: providedCheckInId, 
            newStatus, 
            overview, 
            nextSteps, 
            communicationWithClient, 
            outcome,
            imageUrls,
            measurements,
            checkOutTime,
            durationMinutes,
            durationHours
        } = body;

        console.log(`CheckOut Request: Job=${jobId}, CheckIn=${providedCheckInId}, User=${user.email}`);

        if (!jobId) {
            return Response.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // 1. Verify/Find CheckIn
        let checkIn = null;
        const userEmail = (user.email || "").toLowerCase().trim();
        let checkInId = providedCheckInId;

        // Strategy A: Try getting by ID if provided
        if (checkInId) {
            // Try User Scope first (consistent with frontend visibility)
            try {
                checkIn = await base44.entities.CheckInOut.get(checkInId);
                console.log("Found CheckIn via User Scope");
            } catch (e) {
                console.warn(`User-scope get failed for ${checkInId}, trying service role...`);
                // Fallback to Service Role
                try {
                    checkIn = await base44.asServiceRole.entities.CheckInOut.get(checkInId);
                    console.log("Found CheckIn via Service Role");
                } catch (serviceErr) {
                    console.warn(`Service-role get failed for ${checkInId}, attempting fallback search...`);
                }
            }
        }

        // Strategy B: Search for active check-in for this job and user if not found by ID
        if (!checkIn) {
            console.log(`Strategy B: Searching all check-ins for job ${jobId} (User: ${userEmail})`);
            try {
                // Fetch active check-ins for this job
                const jobCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
                    job_id: jobId
                });
                
                // Find active check-in owned by this user
                checkIn = jobCheckIns.find(c => {
                    if (c.check_out_time) return false; // Skip closed sessions
                    
                    const techEmail = (c.technician_email || "").toLowerCase().trim();
                    const creatorEmail = (c.created_by || "").toLowerCase().trim();
                    return techEmail === userEmail || creatorEmail === userEmail;
                });
                
                if (checkIn) {
                    console.log(`Found active check-in for user: ${checkIn.id}`);
                    checkInId = checkIn.id;
                } else if (user.role === 'admin' || user.role === 'manager') {
                    // Admin Override: Find ANY active check-in for this job
                    checkIn = jobCheckIns.find(c => !c.check_out_time);
                    if (checkIn) {
                        console.log(`Admin/Manager found active check-in for ${checkIn.technician_email}: ${checkIn.id}`);
                        checkInId = checkIn.id;
                    }
                }
            } catch (e) {
                console.error("Error searching for check-in:", e);
            }
        }

        // GHOST CHECKOUT LOGIC
        // If we STILL don't have a check-in record, we proceed anyway but mark it as a "ghost" checkout
        // This means we won't update any CheckInOut record, but we WILL create the JobSummary and update the Job status
        if (!checkIn) {
             console.warn(`GHOST CHECKOUT: No active check-in found for Job ${jobId} User ${userEmail}. Creating summary anyway.`);
             // Mock a check-in object for the rest of the logic to use
             // We assume check-in happened 1 hour ago if we don't know
             const simulatedCheckInTime = new Date(new Date(checkOutTime).getTime() - (Number(durationMinutes || 60) * 60 * 1000)).toISOString();
             
             checkIn = {
                id: null, // Indicates no record to update
                check_in_time: simulatedCheckInTime,
                technician_email: userEmail,
                technician_name: user.full_name || user.email
             };
             checkInId = null;
        } else {
            // Validate ownership for non-admins if it's a real record
            const checkInEmail = (checkIn.technician_email || "").toLowerCase().trim();
            if (checkInEmail !== userEmail && user.role !== 'admin' && user.role !== 'manager') {
                 console.warn(`Unauthorized checkout attempt. User: ${userEmail}, CheckIn Tech: ${checkInEmail}`);
                 return Response.json({ error: 'Unauthorized to check out this session' }, { status: 403 });
            }
            
            // Check idempotency
            if (checkIn.check_out_time) {
                console.log(`Check-in ${checkIn.id} is already checked out. Returning success.`);
                return Response.json({ success: true, message: "Already checked out", checkIn });
            }
        }

        // 2. Get Job
        let job;
        try {
            job = await base44.asServiceRole.entities.Job.get(jobId);
        } catch (e) {
            console.error(`Failed to get Job ${jobId}:`, e);
            return Response.json({ error: `Job with ID ${jobId} not found` }, { status: 404 });
        }

        if (!job) {
            return Response.json({ error: `Job with ID ${jobId} returned null` }, { status: 404 });
        }

        // 3. Update CheckInOut record (Skip if ghost)
        if (checkInId) {
            try {
                console.log(`Updating CheckInOut ${checkInId} with checkout time ${checkOutTime}`);
                await base44.asServiceRole.entities.CheckInOut.update(checkInId, {
                    check_out_time: checkOutTime,
                    duration_hours: Number(durationHours) || 0
                });
            } catch (e) {
                console.error(`CRITICAL: Failed to update CheckInOut ${checkInId}:`, e);
                return Response.json({ 
                    error: `Failed to close check-in session: ${e.message}. Please try again.` 
                }, { status: 500 });
            }
        }

        // 4. Create JobSummary
        let scheduledDatetime = null;
        if (job.scheduled_date) {
            try {
                const dateStr = job.scheduled_date;
                let timeStr = job.scheduled_time || '09:00';
                if (!/^\d{1,2}:\d{2}/.test(timeStr)) {
                     timeStr = '09:00';
                }
                const dateObj = new Date(`${dateStr}T${timeStr}:00`);
                if (!isNaN(dateObj.getTime())) {
                    scheduledDatetime = dateObj.toISOString();
                }
            } catch (e) {
                console.warn("Failed to parse scheduled datetime:", e);
            }
        }

        const cleanDurationMinutes = Number(durationMinutes);
        const validDurationMinutes = !isNaN(cleanDurationMinutes) ? cleanDurationMinutes : 0;
        
        const summaryData = {
            job_id: jobId,
            project_id: job.project_id || null,
            job_number: job.job_number,
            job_type: job.job_type_name || null,
            scheduled_datetime: scheduledDatetime,
            technician_email: user.email || "",
            technician_name: user.full_name || user.email || "Unknown Technician",
            check_in_time: checkIn.check_in_time,
            check_out_time: checkOutTime,
            duration_minutes: validDurationMinutes,
            overview: overview || "",
            next_steps: nextSteps || "",
            communication_with_client: communicationWithClient || "",
            outcome: outcome || "",
            status_at_checkout: newStatus,
            photo_urls: Array.isArray(imageUrls) ? imageUrls.filter(u => typeof u === 'string') : [],
            measurements: measurements || {}
        };

        console.log("Creating JobSummary:", JSON.stringify(summaryData));

        let jobSummary;
        try {
            jobSummary = await base44.asServiceRole.entities.JobSummary.create(summaryData);
        } catch (e) {
            console.error("Failed to create JobSummary:", e);
            return Response.json({ error: `Failed to create Job Summary: ${e.message}` }, { status: 500 });
        }

        // 5. Update Job
        try {
            await base44.asServiceRole.entities.Job.update(jobId, {
                overview: overview,
                next_steps: nextSteps,
                communication_with_client: communicationWithClient,
                outcome: outcome,
                status: newStatus
            });
        } catch (e) {
            console.error("Failed to update Job:", e);
        }

        // 6. Sync to Project
        if (job.project_id) {
            try {
                await base44.functions.invoke('syncJobToProject', { job_id: jobId });
                
                // Auto-advance project stage
                const outcomeToStageMap = {
                  'new_quote': 'Create Quote',
                  'update_quote': 'Create Quote',
                  'send_invoice': 'Completed',
                  'completed': 'Completed',
                  'return_visit_required': 'Scheduled'
                };
                
                const newProjectStage = outcomeToStageMap[outcome];
                if (newProjectStage) {
                  const project = await base44.asServiceRole.entities.Project.get(job.project_id);
                  if (project && project.status !== newProjectStage) {
                    await base44.asServiceRole.entities.Project.update(job.project_id, { status: newProjectStage });
                    
                    if (newProjectStage === 'Completed') {
                        await base44.functions.invoke('handleProjectCompletion', {
                          project_id: job.project_id,
                          new_status: 'Completed',
                          old_status: project.status,
                          completed_date: new Date().toISOString().split('T')[0]
                        });
                    }
                  }
                }
            } catch (err) {
                console.error("Sync to project failed:", err);
            }
        }

        return Response.json({ success: true, jobSummary });

    } catch (error) {
        console.error("CRITICAL ERROR in performCheckOut:", error);
        return Response.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
});