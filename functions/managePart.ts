import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';
import { LOGISTICS_PURPOSE } from './shared/constants.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id, data } = await req.json();

        let part;
        let previousPart = null;

        if (action === 'create') {
            part = await base44.asServiceRole.entities.Part.create(data);
            
            // Update project activity when part is created
            if (part.project_id) {
                await updateProjectActivity(base44, part.project_id, 'Part Created');
            }

            // DEPRECATED: Legacy logistics automation removed
            // Use createLogisticsJobForPO for PO-based logistics
            // Use recordStockMovement for manual part movements

        } else if (action === 'update') {
            // Fetch previous state for logic comparison
            previousPart = await base44.asServiceRole.entities.Part.get(id);
            part = await base44.asServiceRole.entities.Part.update(id, data);
            
            // Update project activity when part is updated
            if (part.project_id) {
                await updateProjectActivity(base44, part.project_id, 'Part Updated');
            }
        } else if (action === 'delete') {
            await base44.asServiceRole.entities.Part.delete(id);
            return Response.json({ success: true });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        // TRIGGER B: When Part is marked Delivered at Delivery Bay → create “Delivery – At Warehouse” job
        if (part.status === 'Delivered' && part.location === 'At Delivery Bay') {
            const wasTriggered = previousPart && 
                                previousPart.status === 'Delivered' && 
                                previousPart.location === 'At Delivery Bay';
            
            if (!wasTriggered) {
                const project = await base44.asServiceRole.entities.Project.get(part.project_id);
                if (project) {
                    const otherParts = await base44.asServiceRole.entities.Part.filter({
                        project_id: part.project_id,
                        status: 'Delivered',
                        location: 'At Delivery Bay'
                    });

                    const jobTypeName = "Delivery – At Warehouse";
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: jobTypeName,
                             description: "Logistics: Delivery of parts at warehouse",
                             color: "#3b82f6",
                             estimated_duration: 0.5,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    const existingJobs = await base44.asServiceRole.entities.Job.filter({
                        project_id: part.project_id,
                        job_type: jobTypeName,
                        status: { $in: ['Open', 'Scheduled'] }
                    });

                    let logisticsJob;

                    if (existingJobs.length > 0) {
                        logisticsJob = existingJobs[0];
                    } else {
                        const customerId = project.customer_id;
                        const warehouseAddress = "Warehouse Delivery Bay";

                        logisticsJob = await base44.asServiceRole.entities.Job.create({
                            job_type: jobTypeName,
                            job_type_id: jobTypeId,
                            job_type_name: jobTypeName,
                            project_id: part.project_id,
                            project_name: project.title,
                            customer_id: customerId,
                            customer_name: project.customer_name,
                            address: warehouseAddress,
                            address_full: warehouseAddress,
                            status: "Open",
                            notes: `Logistics job generated for parts: ${otherParts.map(p => p.category).join(', ')}`
                        });
                    }

                    const partIdsToUpdate = otherParts.map(p => p.id);
                    if (!partIdsToUpdate.includes(part.id)) partIdsToUpdate.push(part.id);

                    for (const pId of partIdsToUpdate) {
                        const p = otherParts.find(op => op.id === pId) || part;
                        const currentLinks = p.linked_logistics_jobs || [];
                        if (!currentLinks.includes(logisticsJob.id)) {
                             await base44.asServiceRole.entities.Part.update(pId, {
                                 linked_logistics_jobs: [...currentLinks, logisticsJob.id]
                             });
                        }
                    }
                }
            }
        }

        return Response.json({ success: true, part });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});