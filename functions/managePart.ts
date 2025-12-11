// PARTIALLY DEPRECATED: Auto-logistics job creation logic in this function uses old Part schema.
// For new logistics workflows, prefer using createLogisticsJobForPO and recordStockMovement.
// The CRUD operations (create/update/delete Part) are still valid.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

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

            // LOGISTICS AUTOMATION LOGIC
            // Only on create, if project_id exists and part is Ordered
            if (part.project_id && 
                (part.status === "Ordered" || part.status === "Pending") && // Relaxed to Pending/Ordered as usually created as Ordered
                (part.supplier_id || part.supplier_name)) {
                
                try {
                    // Fetch supplier if ID exists
                    let supplier = null;
                    if (part.supplier_id) {
                        supplier = await base44.asServiceRole.entities.Supplier.get(part.supplier_id);
                    }

                    // Determine Fulfilment Preference
                    // Default to pickup if not set
                    let fulfilmentPreference = supplier?.fulfilment_preference || "pickup";

                    // If mixed, try to infer from source_type
                    if (fulfilmentPreference === "mixed") {
                        const sourceType = (part.source_type || "").toLowerCase();
                        if (sourceType.includes("pickup")) {
                            fulfilmentPreference = "pickup";
                        } else if (sourceType.includes("deliver") || sourceType.includes("delivery")) {
                            fulfilmentPreference = "delivery";
                        } else {
                            fulfilmentPreference = "pickup"; // Default
                        }
                    } else if (fulfilmentPreference === "delivery") {
                         // If preference is delivery, we should ideally create a delivery job
                         // BUT if the user explicitly set source_type to "Supplier - Pickup Required", we might want to respect that?
                         // The prompt says "Create a Material Delivery... if Supplier is usually Delivery".
                         // And "If they are usually Delivery... automatically create...".
                         // So we prioritize the supplier preference unless the source type STRONGLY contradicts?
                         // Let's assume supplier preference + automation is key here.
                         // However, if source_type is explicit "Pickup Required", it would be weird to create a Delivery job.
                         // Let's trust the mixed logic: if source_type explicitly says Pickup, we do Pickup.
                         // Otherwise if Supplier is Delivery, we do Delivery.
                         const sourceType = (part.source_type || "").toLowerCase();
                         if (sourceType.includes("pickup")) {
                             fulfilmentPreference = "pickup";
                         }
                    }

                    // Determine details
                    const supplierName = supplier?.name || part.supplier_name || "Unknown Supplier";
                    const project = await base44.asServiceRole.entities.Project.get(part.project_id);

                    if (project) {
                        let jobTypeName;
                        let jobDescription;
                        let jobColor;
                        let jobNotes;
                        let jobAddress;
                        let newLocation;

                        if (fulfilmentPreference === "delivery") {
                            jobTypeName = "Material Delivery – Supplier";
                            jobDescription = "Logistics: Receive delivery from supplier";
                            jobColor = "#3b82f6"; // Blue
                            jobAddress = project.address_full || project.address || "Site Address";
                            
                            let deliveryNote = `Supplier delivery for project ${project.title} from ${supplierName}.`;
                            if (supplier?.delivery_days) {
                                deliveryNote += ` Usual delivery days: ${supplier.delivery_days}.`;
                            }
                            jobNotes = deliveryNote;
                            newLocation = "Awaiting Supplier Delivery";

                        } else {
                            // PICKUP
                            jobTypeName = "Material Pickup – Supplier";
                            jobDescription = "Logistics: Pickup parts from supplier";
                            jobColor = "#f59e0b"; // Amber
                            jobAddress = supplier?.pickup_address || "Address not defined";
                            jobNotes = `Pickup parts for project ${project.title} from ${supplierName}.`;
                            newLocation = "At Supplier";
                        }

                        // Find or Create JobType
                        let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                        let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                        
                        if (!jobTypeId) {
                             const newJobType = await base44.asServiceRole.entities.JobType.create({
                                 name: jobTypeName,
                                 description: jobDescription,
                                 color: jobColor,
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
                            address: jobAddress,
                            address_full: jobAddress,
                            status: "Scheduled",
                            notes: jobNotes,
                            overview: `Part: ${part.category}${part.notes ? ' - ' + part.notes : ''}`,
                            additional_info: `Order Ref: ${part.order_reference || 'N/A'}`
                        });

                        // Update Part with linked job and location
                        const currentLinks = part.linked_logistics_jobs || [];
                        await base44.asServiceRole.entities.Part.update(part.id, {
                            linked_logistics_jobs: [...currentLinks, logisticsJob.id],
                            location: newLocation // Update location based on job type
                        });

                        // Update local part object
                        part.linked_logistics_jobs = [...currentLinks, logisticsJob.id];
                        part.location = newLocation;
                    }
                } catch (err) {
                    console.error("Error auto-creating supplier logistics job:", err);
                }
            }

        } else if (action === 'update') {
            // Fetch previous state for logic comparison
            previousPart = await base44.asServiceRole.entities.Part.get(id);
            part = await base44.asServiceRole.entities.Part.update(id, data);
            
            // Update project activity when part is updated
            if (part.project_id) {
                await updateProjectActivity(base44, part.project_id);
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