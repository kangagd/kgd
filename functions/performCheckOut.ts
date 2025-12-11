import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        console.log("performCheckOut: user", user?.email, "role", user?.role);

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
            durationHours,
            issuesFound,
            resolution
        } = await req.json();

        // Sanitize inputs
        const safeDurationHours = (typeof durationHours === 'number' && !isNaN(durationHours)) ? durationHours : 0;
        const safeDurationMinutes = (typeof durationMinutes === 'number' && !isNaN(durationMinutes)) ? durationMinutes : 0;
        const safeCheckOutTime = checkOutTime || new Date().toISOString();

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

        // Update CheckInOut record with check-out details
        await base44.asServiceRole.entities.CheckInOut.update(checkInId, {
            check_out_time: safeCheckOutTime,
            check_out_notes: overview || "",
            duration_hours: safeDurationHours
        });
        
        console.log(`✅ CheckInOut ${checkInId} updated with check_out_time: ${safeCheckOutTime}`);

        // Create JobSummary
        let scheduledDatetime = null;
        if (job.scheduled_date) {
            try {
                const dateStr = job.scheduled_date;
                const timeStr = job.scheduled_time || '09:00';
                // Handle simplified date strings or full ISO
                if (dateStr.includes('T')) {
                    scheduledDatetime = new Date(dateStr).toISOString();
                } else {
                    scheduledDatetime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
                }
            } catch (e) {
                console.warn("Error parsing scheduled_date:", e);
            }
        }

        // Fetch recent chat messages for context
        let chatTranscript = "";
        try {
            const jobMessages = await base44.asServiceRole.entities.JobMessage.filter({ job_id: jobId }, '-created_date', 20);
            if (jobMessages && jobMessages.length > 0) {
                // Sort historically and format
                chatTranscript = jobMessages.reverse().map(m => `${m.sender_name}: ${m.message}`).join('\n');
            }
        } catch (e) {
            console.warn("Failed to fetch job messages for summary:", e);
        }

        // Generate AI Summary
        let aiGeneratedSummary = "";
        if (overview || nextSteps || communicationWithClient || chatTranscript) {
             try {
                const prompt = `
You are a helpful assistant for a field service technician team.
Please generate a concise summary of the job visit based on the following inputs:

Overview: ${overview || 'N/A'}
Next Steps: ${nextSteps || 'N/A'}
Client Communication: ${communicationWithClient || 'N/A'}
Recent Chat Log:
${chatTranscript || 'No chat history'}

The summary should be a single paragraph, professional, and capture the key work done, outcomes, and any important follow-ups.
`;
                const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: prompt
                });
                if (llmRes && llmRes.data) {
                    aiGeneratedSummary = llmRes.data;
                }
             } catch (e) {
                 console.error("AI Summary generation failed:", e);
             }
        }

        const summaryData = {
            job_id: jobId,
            project_id: job.project_id || null,
            job_number: String(job.job_number || ""),
            job_type: job.job_type_name || null,
            scheduled_datetime: scheduledDatetime,
            technician_email: user.email || "",
            technician_name: user.full_name || user.email || "Unknown Technician",
            check_in_time: checkIn.check_in_time || new Date().toISOString(),
            check_out_time: safeCheckOutTime,
            duration_minutes: safeDurationMinutes,
            overview: overview || "",
            issues_found: issuesFound || "",
            resolution: resolution || "",
            next_steps: nextSteps || "",
            communication_with_client: communicationWithClient || "",
            outcome: outcome || "",
            status_at_checkout: newStatus,
            photo_urls: imageUrls || [],
            measurements: measurements || {},
            ai_generated_summary: aiGeneratedSummary
        };

        console.log("Creating JobSummary with data:", JSON.stringify(summaryData));

        let jobSummary;
        try {
            jobSummary = await base44.asServiceRole.entities.JobSummary.create(summaryData);
        } catch (e) {
            console.error("Failed to create JobSummary:", e);
            throw new Error(`JobSummary creation failed: ${e.message}`);
        }

        // Update Job - mark as completed unless outcome is return_visit_required
        try {
            const finalStatus = (outcome === 'return_visit_required') ? newStatus : 'Completed';
            console.log(`🔄 Updating Job ${jobId} with status: ${finalStatus}, outcome: ${outcome}`);
            
            await base44.asServiceRole.entities.Job.update(jobId, {
                overview: overview,
                next_steps: nextSteps,
                communication_with_client: communicationWithClient,
                outcome: outcome,
                status: finalStatus
            });
            
            console.log(`✅ Job ${jobId} updated successfully with status: ${finalStatus}`);
        } catch (e) {
             console.error("❌ Failed to update Job:", e);
             // We don't throw here to ensure we return the summary if created
        }

        // Sync to Project
        if (job.project_id) {
            try {
                // Use service role to invoke functions to ensure permissions
                await base44.asServiceRole.functions.invoke('syncJobToProject', { job_id: jobId });

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
                        await base44.asServiceRole.functions.invoke('handleProjectCompletion', {
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

        // LOGISTICS AUTOMATION (Triggers C, E, F)
        try {
            const finalStatus = (outcome === 'return_visit_required') ? newStatus : 'Completed';
            const jobType = job.job_type_name || job.job_type;
            if (jobType && finalStatus === 'Completed') {
                // Find linked parts for this job
                // Part entity has linked_logistics_jobs array containing job IDs
                // We need to find parts where linked_logistics_jobs contains jobId
                // No direct array contains query in filter usually, so we might need to fetch project parts and filter in memory
                // Or if your DB supports it. Base44 filter might support array contains? 
                // Usually filter: { linked_logistics_jobs: jobId } works if it's an array field in mongo-like.

                const linkedParts = await base44.asServiceRole.entities.Part.filter({
                    project_id: job.project_id // Optimization: scope to project
                });

                const relevantParts = linkedParts.filter(p => 
                    p.linked_logistics_jobs && p.linked_logistics_jobs.includes(jobId)
                );

                // Logistics automation now handled by Job outcome logic
                // Legacy logistics job types removed - use PO status sync instead
            }
        } catch (logisticsErr) {
            console.error("Logistics automation failed", logisticsErr);
        }

        return Response.json({ success: true, jobSummary });

    } catch (error) {
        console.error("performCheckOut ERROR:", error, error?.stack);
        return Response.json({ error: error.message || 'Unknown error in performCheckOut' }, { status: 500 });
    }
});