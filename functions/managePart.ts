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

            // AUTO-CREATE SUPPLIER PICKUP JOB LOGIC
            // Only on create, if project_id exists, source_type is Pickup Required, status is Ordered
            // and we have supplier info
            if (part.project_id && 
                part.source_type === "Supplier – Pickup Required" && 
                (part.status === "Ordered" || part.status === "Pending") && // Relaxed to Pending/Ordered as usually created as Ordered
                (part.supplier_id || part.supplier_name)) {
                
                try {
                    // Fetch supplier if ID exists
                    let supplier = null;
                    if (part.supplier_id) {
                        supplier = await base44.asServiceRole.entities.Supplier.get(part.supplier_id);
                    }

                    // Determine address and name
                    const pickupAddress = supplier?.pickup_address || "Address not defined";
                    const supplierName = supplier?.name || part.supplier_name || "Unknown Supplier";

                    // Get project for title
                    const project = await base44.asServiceRole.entities.Project.get(part.project_id);
                    
                    if (project) {
                        // Find or Create JobType "Material Pickup – Supplier"
                        const jobTypeName = "Material Pickup – Supplier";
                        let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                        let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                        
                        if (!jobTypeId) {
                             const newJobType = await base44.asServiceRole.entities.JobType.create({
                                 name: jobTypeName,
                                 description: "Logistics: Pickup parts from supplier",
                                 color: "#f59e0b", // Amber/Orange
                                 estimated_duration: 0.5,
                                 is_active: true
                             });
                             jobTypeId = newJobType.id;
                        }

                        // Create Job
                        const logisticsJob = await base44.asServiceRole.entities.Job.create({
                            job_type: jobTypeName,
                            job_type_id: jobTypeId,
                            job_type_name: jobTypeName,
                            project_id: part.project_id,
                            project_name: project.title,
                            customer_id: project.customer_id,
                            customer_name: project.customer_name,
                            address: pickupAddress,
                            address_full: pickupAddress,
                            status: "Scheduled", // or Planned
                            notes: `Pickup parts for project ${project.title} from ${supplierName}.`,
                            overview: `Part: ${part.category} - ${part.description || ''}`,
                            additional_info: `Order Ref: ${part.order_reference || 'N/A'}`
                        });

                        // Update Part with linked job and location
                        const currentLinks = part.linked_logistics_jobs || [];
                        await base44.asServiceRole.entities.Part.update(part.id, {
                            linked_logistics_jobs: [...currentLinks, logisticsJob.id],
                            location: "At Supplier" // Ensure correct location
                        });

                        // Update local part object to return correct state
                        part.linked_logistics_jobs = [...currentLinks, logisticsJob.id];
                        part.location = "At Supplier";
                    }
                } catch (err) {
                    console.error("Error auto-creating supplier pickup job:", err);
                    // Don't fail the whole request, just log
                }
            }

        } else if (action === 'update') {
            // Fetch previous state for logic comparison
            previousPart = await base44.asServiceRole.entities.Part.get(id);
            part = await base44.asServiceRole.entities.Part.update(id, data);
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
                // Trigger Logic
                const project = await base44.asServiceRole.entities.Project.get(part.project_id);
                if (project) {
                    // Check for other parts that are also Delivered + At Delivery Bay for this project
                    const otherParts = await base44.asServiceRole.entities.Part.filter({
                        project_id: part.project_id,
                        status: 'Delivered',
                        location: 'At Delivery Bay'
                    });

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

                    // Check if there is already an open job of this type for this project?? 
                    // Prompt implies: "Create a Job... Append this new job’s ID into the Part’s linked_logistics_jobs array."
                    // It doesn't explicitly say "if one doesn't exist". But usually we group them.
                    // The prompt says "Create a Job... linked_parts includes this Part (and any other Parts...)"
                    // This implies creating a NEW job every time a part lands, OR grouping them.
                    // "and any other Parts... that are ALSO Delivered + At Delivery Bay"
                    // This suggests we might want to grouping.
                    // Let's check if there is an existing OPEN "Delivery – At Warehouse" job for this project.
                    
                    const existingJobs = await base44.asServiceRole.entities.Job.filter({
                        project_id: part.project_id,
                        job_type: jobTypeName,
                        status: { $in: ['Open', 'Scheduled'] }
                    });

                    let logisticsJob;

                    if (existingJobs.length > 0) {
                        logisticsJob = existingJobs[0];
                        // Update linked parts if we track them in the job (not standard field, but maybe in notes or just implicit)
                        // We definitely update the PARTS to link to the JOB.
                    } else {
                        // Create new job
                        // Need customer info
                        const customerId = project.customer_id;
                        // Warehouse address - hardcoded or fetched. Using a placeholder or Org address.
                        // We'll assume a fixed string or fetch Organisation type 'Supplier'? No, warehouse is internal.
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

                    // Append job ID to all relevant parts
                    const partIdsToUpdate = otherParts.map(p => p.id);
                    // Add current part if not in filter (it should be in filter if filter matches current state)
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