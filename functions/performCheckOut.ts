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
            checkInId, 
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

        console.log(`CheckOut Request: Job=${jobId}, CheckIn=${checkInId}, User=${user.email}`);

        if (!jobId || !checkInId) {
            return Response.json({ error: 'Job ID and CheckIn ID are required' }, { status: 400 });
        }

        // 1. Verify/Find CheckIn
        let checkIn;
        const userEmail = (user.email || "").toLowerCase().trim();

        // Strategy A: Try getting by ID if provided
        if (checkInId) {
            try {
                checkIn = await base44.asServiceRole.entities.CheckInOut.get(checkInId);
            } catch (e) {
                console.warn(`Failed to get CheckIn by ID ${checkInId}, attempting fallback search...`);
            }
        }

        // Strategy B: Search for active check-in for this job and user if not found by ID
        if (!checkIn) {
            console.log(`Searching for active check-in for job ${jobId} and user ${userEmail}`);
            try {
                // We need to find a record where check_out_time is missing/null
                // Note: Filtering for null/missing fields might depend on the SDK capabilities, 
                // so we'll filter for the job and user, then find the open one in memory if needed.
                // Assuming filter supports basic equality.
                const userCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
                    job_id: jobId,
                    technician_email: userEmail
                });
                
                // Find the one with no check_out_time
                checkIn = userCheckIns.find(c => !c.check_out_time);
                
                // Fallback: try finding by created_by if technician_email didn't match (rare edge case)
                if (!checkIn) {
                     const createdCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
                        job_id: jobId,
                        created_by: userEmail
                    });
                    checkIn = createdCheckIns.find(c => !c.check_out_time);
                }

            } catch (e) {
                console.error("Error searching for check-in:", e);
            }
        }

        if (!checkIn) {
            return Response.json({ error: 'No active check-in found for this job' }, { status: 404 });
        }

        const checkInEmail = (checkIn.technician_email || "").toLowerCase().trim();
        
        // Double check ownership (though search already filtered by email, the ID fetch might not have)
        if (checkInEmail !== userEmail && user.role !== 'admin' && user.role !== 'manager') {
             console.warn(`Unauthorized checkout attempt. User: ${userEmail}, CheckIn Tech: ${checkInEmail}`);
             return Response.json({ error: 'Unauthorized to check out this session' }, { status: 403 });
        }
        
        // Update checkInId to the one we found, in case we found it via search
        checkInId = checkIn.id;

        // 2. Get Job
        let job;
        try {
            job = await base44.asServiceRole.entities.Job.get(jobId);
        } catch (e) {
            console.error(`Failed to get Job ${jobId}:`, e);
            return Response.json({ error: 'Job not found or error retrieving it' }, { status: 404 });
        }

        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // 3. Update CheckInOut record
        try {
            await base44.asServiceRole.entities.CheckInOut.update(checkInId, {
                check_out_time: checkOutTime,
                duration_hours: Number(durationHours) || 0
            });
        } catch (e) {
            console.error("Failed to update CheckInOut:", e);
            return Response.json({ error: `Failed to update check-in record: ${e.message}` }, { status: 500 });
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
            // Try to proceed even if summary fails? No, this is critical.
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
            // Non-critical? Maybe. But status update is important.
            // We'll log but return success for the checkout itself as CheckOut/Summary are done.
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