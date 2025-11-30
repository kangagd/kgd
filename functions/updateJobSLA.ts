import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { job_id } = await req.json();
        if (!job_id) return Response.json({ error: 'Missing job_id' }, { status: 400 });

        const job = await base44.asServiceRole.entities.Job.get(job_id);
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        const updates = {};
        let contract = null;

        // 1. Determine SLA Due Date if not set
        if (!job.sla_due_at && job.contract_id) {
            contract = await base44.asServiceRole.entities.Contract.get(job.contract_id);
            if (contract && contract.sla_response_time_hours) {
                const createdAt = new Date(job.created_date);
                const dueAt = new Date(createdAt.getTime() + (contract.sla_response_time_hours * 60 * 60 * 1000));
                updates.sla_due_at = dueAt.toISOString();
                updates.is_contract_job = true;
            }
        }

        // 2. Check if SLA Met if completed
        if (job.status === 'Completed') {
            // We need the SLA due date. If we just calculated it, use it. Else use existing.
            const slaDueAtStr = updates.sla_due_at || job.sla_due_at;
            
            if (slaDueAtStr) {
                const slaDueAt = new Date(slaDueAtStr);
                let responseTime = null;

                // Try to find CheckIn time
                const summaries = await base44.asServiceRole.entities.JobSummary.filter({ job_id: job_id });
                const checkIn = summaries.find(s => s.check_in_time);
                
                if (checkIn) {
                    responseTime = new Date(checkIn.check_in_time);
                } else {
                    // Fallback to completed_date or updated_date if checkin missing (not ideal but better than nothing)
                    // Better fallback: If we have scheduled date? No, that's when it was scheduled.
                    // Let's use updated_date as a conservative proxy for completion if check-in missing.
                    // Or search CheckInOut entity
                    const checkInOuts = await base44.asServiceRole.entities.CheckInOut.filter({ job_id: job_id });
                    if (checkInOuts.length > 0) {
                         // Sort by check_in_time asc to get first arrival
                         checkInOuts.sort((a, b) => new Date(a.check_in_time) - new Date(b.check_in_time));
                         responseTime = new Date(checkInOuts[0].check_in_time);
                    }
                }
                
                // If still no response time, we can't accurately judge, but let's assume met if we don't know? 
                // Or mark as not met if completed late?
                // Let's use completed date as worst case scenario
                if (!responseTime) {
                     responseTime = job.completed_date ? new Date(job.completed_date) : new Date(job.updated_date);
                }

                updates.sla_met = responseTime <= slaDueAt;
            }
        }

        if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Job.update(job_id, updates);
        }

        return Response.json({ success: true, updates });

    } catch (error) {
        console.error("Update Job SLA Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});