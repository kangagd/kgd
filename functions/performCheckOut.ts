import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
        } = await req.json();

        if (!jobId || !checkInId) {
            return Response.json({ error: 'Job ID and CheckIn ID are required' }, { status: 400 });
        }

        // Verify CheckIn ownership
        const checkIn = await base44.asServiceRole.entities.CheckInOut.get(checkInId);
        if (!checkIn) {
            return Response.json({ error: 'Check-in record not found' }, { status: 404 });
        }

        if (checkIn.technician_email !== user.email && user.role !== 'admin' && user.role !== 'manager') {
             return Response.json({ error: 'Unauthorized to check out this session' }, { status: 403 });
        }

        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Update CheckInOut record
        await base44.asServiceRole.entities.CheckInOut.update(checkInId, {
            check_out_time: checkOutTime,
            duration_hours: durationHours
        });

        // Create JobSummary
        let scheduledDatetime = null;
        if (job.scheduled_date) {
            try {
                const dateStr = job.scheduled_date;
                // Clean time string to ensure it's in HH:MM format if possible, or default to 09:00
                let timeStr = job.scheduled_time || '09:00';
                // Basic check if timeStr looks like HH:MM
                if (!/^\d{1,2}:\d{2}/.test(timeStr)) {
                     timeStr = '09:00';
                }
                
                const dateObj = new Date(`${dateStr}T${timeStr}:00`);
                if (!isNaN(dateObj.getTime())) {
                    scheduledDatetime = dateObj.toISOString();
                }
            } catch (e) {
                console.warn("Failed to parse scheduled datetime:", e);
                // Ignore invalid dates, leave as null
            }
        }

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
            duration_minutes: durationMinutes || 0,
            overview: overview || "",
            next_steps: nextSteps || "",
            communication_with_client: communicationWithClient || "",
            outcome: outcome || "",
            status_at_checkout: newStatus,
            photo_urls: imageUrls || [],
            measurements: measurements || {}
        };
        
        // Explicitly set created_by to ensure RLS consistency for the user
        summaryData.created_by = user.email;

        console.log("Creating JobSummary with data:", JSON.stringify(summaryData));

        const jobSummary = await base44.asServiceRole.entities.JobSummary.create(summaryData);

        // Update Job
        await base44.asServiceRole.entities.Job.update(jobId, {
            overview: overview,
            next_steps: nextSteps,
            communication_with_client: communicationWithClient,
            outcome: outcome,
            status: newStatus
        });

        // Sync to Project
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
                console.error("Sync to project failed", err);
            }
        }

        return Response.json({ success: true, jobSummary });

    } catch (error) {
        console.error("CRITICAL ERROR in performCheckOut:", error);
        return Response.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
});