import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        } else if (action === 'update') {
            // Fetch previous state for logic comparison
            previousPart = await base44.asServiceRole.entities.Part.get(id);
            part = await base44.asServiceRole.entities.Part.update(id, data);

            // Notify on Delivery
            if (data.status === 'Delivered' && previousPart.status !== 'Delivered') {
                const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
                for (const admin of admins) {
                    await base44.asServiceRole.functions.invoke('createNotification', {
                        userId: admin.id,
                        title: "Part Delivered",
                        message: `Part ${part.category} has been delivered to ${part.location}.`,
                        entityType: "Part",
                        entityId: part.id,
                        priority: "normal"
                    });
                }
            }
        } else if (action === 'delete') {
            await base44.asServiceRole.entities.Part.delete(id);
            return Response.json({ success: true });
        } else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        // TRIGGER A: When Part is Ordered + Supplier Source (Pickup Required) → Create “Material Pickup – Supplier”
        if (part.status === 'Ordered' && part.source_type === 'Supplier – Pickup Required') {
             const wasTriggered = previousPart && previousPart.status === 'Ordered';
             if (!wasTriggered) {
                 const project = await base44.asServiceRole.entities.Project.get(part.project_id);
                 if (project) {
                     const jobTypeName = "Material Pickup – Supplier";
                     let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                     let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                     if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: jobTypeName,
                             description: "Logistics: Pickup material from supplier",
                             color: "#f59e0b", 
                             estimated_duration: 1,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                     }

                     const logisticsJob = await base44.asServiceRole.entities.Job.create({
                         job_type: jobTypeName,
                         job_type_id: jobTypeId,
                         job_type_name: jobTypeName,
                         job_category: "Logistics",
                         logistics_type: "Material Pickup – Supplier",
                         project_id: part.project_id,
                         project_name: project.title,
                         customer_id: project.customer_id,
                         customer_name: project.customer_name,
                         address: "Supplier: " + (part.supplier_name || "Unknown"),
                         address_full: "Supplier: " + (part.supplier_name || "Unknown"),
                         status: "Open",
                         part_ids: [part.id],
                         notes: `Pickup for: ${part.category} (Order Ref: ${part.order_reference || 'N/A'})`
                     });

                     const currentLinks = part.linked_logistics_jobs || [];
                     await base44.asServiceRole.entities.Part.update(part.id, {
                         linked_logistics_jobs: [...currentLinks, logisticsJob.id]
                     });
                 }
             }
        }

        // TRIGGER B: When Part is marked Delivered at Delivery Bay → create “Delivery – At Warehouse” job
        if (part.status === 'Delivered' && part.location === 'At Delivery Bay') {
            const wasTriggered = previousPart && 
                                previousPart.status === 'Delivered' && 
                                previousPart.location === 'At Delivery Bay';
            
            if (!wasTriggered) {
                const project = await base44.asServiceRole.entities.Project.get(part.project_id);
                if (project) {
                    // Check for other parts that are also Delivered + At Delivery Bay for this project
                    const otherParts = await base44.asServiceRole.entities.Part.filter({
                        project_id: part.project_id,
                        status: 'Delivered',
                        location: 'At Delivery Bay'
                    });

                    // Prepare part IDs list first to avoid ReferenceError
                    const partIdsToUpdate = otherParts.map(p => p.id);
                    if (!partIdsToUpdate.includes(part.id)) partIdsToUpdate.push(part.id);

                    // Find or Create JobType
                    const jobTypeName = "Delivery – At Warehouse";
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: jobTypeName,
                             description: "Logistics: Delivery of parts at warehouse",
                             color: "#3b82f6", // Blueish
                             estimated_duration: 0.5,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    // Check if there is already an open job of this type for this project
                    const existingJobs = await base44.asServiceRole.entities.Job.filter({
                        project_id: part.project_id,
                        job_type: jobTypeName,
                        status: { $in: ['Open', 'Scheduled'] }
                    });

                    let logisticsJob;

                    if (existingJobs.length > 0) {
                        logisticsJob = existingJobs[0];
                        // Update existing job part_ids if necessary
                        const currentPartIds = logisticsJob.part_ids || [];
                        const newPartIds = [...new Set([...currentPartIds, ...partIdsToUpdate])];
                        if (newPartIds.length > currentPartIds.length) {
                            await base44.asServiceRole.entities.Job.update(logisticsJob.id, {
                                part_ids: newPartIds,
                                notes: logisticsJob.notes + `\nAdded parts: ${otherParts.map(p => p.category).join(', ')}`
                            });
                        }
                    } else {
                        // Create new job
                        const customerId = project.customer_id;
                        const warehouseAddress = "Warehouse Delivery Bay";

                        logisticsJob = await base44.asServiceRole.entities.Job.create({
                            job_type: jobTypeName,
                            job_type_id: jobTypeId,
                            job_type_name: jobTypeName,
                            job_category: "Logistics",
                            logistics_type: "Delivery – At Warehouse",
                            project_id: part.project_id,
                            project_name: project.title,
                            customer_id: customerId,
                            customer_name: project.customer_name,
                            address: warehouseAddress,
                            address_full: warehouseAddress,
                            status: "Open",
                            part_ids: partIdsToUpdate,
                            notes: `Logistics job generated for parts: ${otherParts.map(p => p.category).join(', ')}`
                        });
                    }

                    // Append job ID to all relevant parts
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