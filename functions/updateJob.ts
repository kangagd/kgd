import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, data } = await req.json();

        // Fetch previous state
        const previousJob = await base44.asServiceRole.entities.Job.get(id);
        if (!previousJob) return Response.json({ error: 'Job not found' }, { status: 404 });

        // Perform Update
        const updatedJob = await base44.asServiceRole.entities.Job.update(id, data);

        // TRIGGER D: When an Installation job is scheduled → create “Material Pickup – Warehouse” job
        // Condition: Job type is Installation-like (we'll check "Install" in name or type)
        // And Status changed to Scheduled OR scheduled_date set (implying scheduled)
        
        const isInstall = (updatedJob.job_type_name || "").toLowerCase().includes("install") || 
                          (updatedJob.job_type || "").toLowerCase().includes("install");
        
        const becameScheduled = (updatedJob.status === 'Scheduled' && previousJob.status !== 'Scheduled') ||
                                (updatedJob.scheduled_date && !previousJob.scheduled_date);

        if (isInstall && becameScheduled && updatedJob.project_id) {
            // Check parts
            const parts = await base44.asServiceRole.entities.Part.filter({
                project_id: updatedJob.project_id,
                status: 'Delivered',
                location: 'In Warehouse Storage'
            });

            if (parts.length > 0) {
                // Check if pickup job already exists
                const pickupJobTypeName = "Material Pickup – Warehouse";
                
                const existingPickup = await base44.asServiceRole.entities.Job.filter({
                    project_id: updatedJob.project_id,
                    job_type: pickupJobTypeName,
                    status: { $in: ['Open', 'Scheduled'] }
                });

                if (existingPickup.length === 0) {
                    // Create Pickup Job
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: pickupJobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: pickupJobTypeName,
                             description: "Logistics: Pickup parts from warehouse",
                             color: "#f59e0b", // Amber
                             estimated_duration: 0.5,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    // Calculate suggested time (e.g. 1 hour before install)
                    let scheduledDate = updatedJob.scheduled_date;
                    let scheduledTime = updatedJob.scheduled_time || "09:00";
                    // Simple logic: same date, 1 hour prior. (Handling time math roughly)
                    let pickupTime = "08:00";
                    try {
                        const [h, m] = scheduledTime.split(':').map(Number);
                        let ph = h - 1;
                        if (ph < 7) ph = 7; // Don't go too early
                        pickupTime = `${ph.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    } catch (e) {}

                    const pickupJob = await base44.asServiceRole.entities.Job.create({
                        job_type: pickupJobTypeName,
                        job_type_id: jobTypeId,
                        job_type_name: pickupJobTypeName,
                        project_id: updatedJob.project_id,
                        project_name: updatedJob.project_name,
                        customer_id: updatedJob.customer_id,
                        customer_name: updatedJob.customer_name,
                        address: "Warehouse",
                        address_full: "Warehouse",
                        status: "Scheduled",
                        scheduled_date: scheduledDate,
                        scheduled_time: pickupTime,
                        expected_duration: 0.5,
                        notes: `Pickup for parts: ${parts.map(p => p.category).join(', ')}`
                    });

                    // Link parts to this new job
                    for (const part of parts) {
                        const currentLinks = part.linked_logistics_jobs || [];
                        if (!currentLinks.includes(pickupJob.id)) {
                            await base44.asServiceRole.entities.Part.update(part.id, {
                                linked_logistics_jobs: [...currentLinks, pickupJob.id]
                            });
                        }
                    }
                }
            }
        }

        return Response.json({ success: true, job: updatedJob });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});