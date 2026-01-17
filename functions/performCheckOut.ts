import { createClientFromRequest } from './shared/sdk.js';
import { updateProjectActivity } from './updateProjectActivity.js';

const DRAFT_FIELDS = ['measurements', 'image_urls', 'other_documents', 'notes', 'overview', 'issues_found', 'resolution', 'pricing_provided', 'additional_info', 'next_steps', 'communication_with_client', 'completion_notes'];

async function safeUpdateDraft(base44, jobId, incomingData) {
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    let updatePayload = {};

    for (const field of DRAFT_FIELDS) {
        if (field in incomingData) {
            const incomingValue = incomingData[field];
            const existingValue = job[field];

            if (Array.isArray(existingValue)) {
                const newItems = Array.isArray(incomingValue) ? incomingValue : [incomingValue].filter(Boolean);
                const merged = [...existingValue, ...newItems];
                updatePayload[field] = [...new Set(merged)]; // Dedupe
            } else if (typeof existingValue === 'object' && existingValue !== null) {
                updatePayload[field] = { ...existingValue, ...incomingValue }; // Shallow merge
            } else if (incomingValue) { // For text fields, only update if new value is not empty
                updatePayload[field] = incomingValue;
            }
        }
    }

    if (Object.keys(updatePayload).length > 0) {
        await base44.asServiceRole.entities.Job.update(jobId, updatePayload);
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { 
            jobId, 
            checkInId, 
            newStatus, 
            outcome,
            // Draft fields
            measurements,
            imageUrls,
            otherDocuments,
            overview, 
            nextSteps, 
            communicationWithClient,
            completionNotes,
            issuesFound,
            resolution
        } = await req.json();

        if (!jobId) {
            return Response.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // All active check-ins for this job
        const allActiveCheckIns = await base44.asServiceRole.entities.CheckInOut.filter({
            job_id: jobId,
            check_out_time: { $exists: false }
        });

        // Any technician can update draft fields at any time if they are checked in
        const currentUserCheckIn = allActiveCheckIns.find(c => c.technician_email === user.email);
        if (currentUserCheckIn) {
            const draftData = { 
                measurements, 
                image_urls: imageUrls, 
                other_documents: otherDocuments,
                overview,
                completion_notes: completionNotes,
                next_steps: nextSteps,
                communication_with_client: communicationWithClient,
                issues_found: issuesFound,
                resolution,
            };
            await safeUpdateDraft(base44, jobId, draftData);
        }
        
        // If this is not a checkout action, exit after draft save
        if (!checkInId) {
            return Response.json({ success: true, message: "Draft fields updated." });
        }

        const isLastTechnician = allActiveCheckIns.length === 1 && currentUserCheckIn;

        // If not the last technician, just check them out without completing the job
        if (!isLastTechnician) {
            if (currentUserCheckIn) {
                const checkOutTime = new Date().toISOString();
                await base44.asServiceRole.entities.CheckInOut.update(currentUserCheckIn.id, { check_out_time: checkOutTime });
                
                // Update Visit: mark this technician's check-in event as checked out
                try {
                    const visits = await base44.asServiceRole.entities.Visit.filter({ 
                        job_id: jobId, 
                        completed_at: { $exists: false } 
                    });
                    
                    if (visits.length > 0) {
                        const visit = visits[0];
                        const checkInEvents = visit.check_in_events || [];
                        
                        const activeEventIndex = checkInEvents.findIndex(
                            e => e.technician_email === user.email && !e.checked_out_at
                        );
                        
                        if (activeEventIndex !== -1) {
                            const updatedEvents = [...checkInEvents];
                            updatedEvents[activeEventIndex] = {
                                ...updatedEvents[activeEventIndex],
                                checked_out_at: checkOutTime
                            };
                            
                            const updatedTechnicians = (visit.checked_in_technicians || []).filter(email => email !== user.email);
                            const updatedNames = (visit.checked_in_names || []).filter((name, idx) => 
                                (visit.checked_in_technicians || [])[idx] !== user.email
                            );
                            
                            await base44.asServiceRole.entities.Visit.update(visit.id, {
                                checked_in_technicians: updatedTechnicians,
                                checked_in_names: updatedNames,
                                check_in_events: updatedEvents
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to update visit on check-out (non-critical):", e);
                }
                
                return Response.json({ success: true, status: 'checked_out', message: 'You have been checked out. Job remains in progress.' });
            }
            return Response.json({ error: 'You are not checked in to this job' }, { status: 400 });
        }

        // --- LAST TECHNICIAN CHECKOUT --- //
        const job = await base44.asServiceRole.entities.Job.get(jobId);

        // Last technician must provide an outcome
        if (!outcome) {
            return Response.json({ error: 'As the last technician, you must select an outcome to complete the job.' }, { status: 400 });
        }

        // Completion payload
        const completionData = { 
            status: 'Completed', 
            outcome,
            overview, 
            completion_notes: completionNotes,
            next_steps: nextSteps
        };
        
        // Final merge of draft fields
        const finalDraftData = { measurements, image_urls: imageUrls, other_documents: otherDocuments };
        await safeUpdateDraft(base44, jobId, finalDraftData);
        
        // Apply completion data
        await base44.asServiceRole.entities.Job.update(jobId, completionData);

        // Check out the last technician
        const checkOutTime = new Date().toISOString();
        await base44.asServiceRole.entities.CheckInOut.update(currentUserCheckIn.id, { check_out_time: checkOutTime });
        
        // Update Visit: mark as completed (last technician checking out)
        try {
            const visits = await base44.asServiceRole.entities.Visit.filter({ 
                job_id: jobId, 
                completed_at: { $exists: false } 
            });
            
            if (visits.length > 0) {
                const visit = visits[0];
                const checkInEvents = visit.check_in_events || [];
                
                const activeEventIndex = checkInEvents.findIndex(
                    e => e.technician_email === user.email && !e.checked_out_at
                );
                
                if (activeEventIndex !== -1) {
                    const updatedEvents = [...checkInEvents];
                    updatedEvents[activeEventIndex] = {
                        ...updatedEvents[activeEventIndex],
                        checked_out_at: checkOutTime
                    };
                    
                    await base44.asServiceRole.entities.Visit.update(visit.id, {
                        checked_in_technicians: [],
                        checked_in_names: [],
                        check_in_events: updatedEvents,
                        work_performed: overview || visit.work_performed,
                        issues_found: issuesFound || visit.issues_found,
                        resolution: resolution || visit.resolution,
                        measurements: measurements || visit.measurements,
                        photos: imageUrls || visit.photos,
                        next_steps: nextSteps || visit.next_steps,
                        outcome: outcome,
                        completed_at: checkOutTime,
                        completed_by_email: user.email,
                        completed_by_name: user.display_name || user.full_name || user.email
                    });
                }
            }
        } catch (e) {
            console.error("Failed to complete visit (non-critical):", e);
        }

        // Post-completion actions
        if (job.project_id) {
            await updateProjectActivity(base44, job.project_id, 'Visit Completed');
        }
        await base44.asServiceRole.functions.invoke('autoDeductJobUsage', { job_id: jobId });


        return Response.json({ success: true, status: 'completed', message: 'Job completed successfully.' });

    } catch (error) {
        console.error("performCheckOut ERROR:", error, error?.stack);
        return Response.json({ error: error.message || 'Unknown error in performCheckOut' }, { status: 500 });
    }
});