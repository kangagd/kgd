import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PO_DELIVERY_METHOD, LOGISTICS_PURPOSE } from './shared/constants.js';
import { generateJobNumber } from './shared/jobNumberGenerator.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { purchase_order_id, technician_id, scheduled_date } = await req.json();

        if (!purchase_order_id) {
            return Response.json({ 
                success: false, 
                error: 'purchase_order_id is required' 
            }, { status: 400 });
        }

        // Fetch the PO
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(purchase_order_id);
        if (!po) {
            return Response.json({ 
                success: false, 
                error: 'Purchase Order not found' 
            }, { status: 404 });
        }

        // Determine logistics purpose and job type based on delivery method
        let logisticsPurpose, jobTypeName, originAddress, destinationAddress;
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            logisticsPurpose = LOGISTICS_PURPOSE.PO_PICKUP_FROM_SUPPLIER;
            jobTypeName = "Ready for Pick Up - Supplier";
        } else {
            // Default to DELIVERY
            logisticsPurpose = LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE;
            jobTypeName = "Delivery in Loading Bay";
        }
            
        let jobTypes = await base44.asServiceRole.entities.JobType.filter({ 
            name: jobTypeName 
        });
        
        if (jobTypes.length === 0) {
            return Response.json({ 
                success: false, 
                error: `JobType "${jobTypeName}" not found. Please ensure it exists.` 
            }, { status: 400 });
        }
        
        const jobTypeId = jobTypes[0].id;

        // Get supplier name and address
        let supplierName = "Supplier";
        let supplierAddress = "";
        if (po.supplier_id) {
            try {
                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                if (supplier) {
                    supplierName = supplier.name;
                    supplierAddress = supplier.pickup_address || supplier.address_full || supplier.address_street || "";
                }
            } catch (error) {
                console.error('Error fetching supplier:', error);
            }
        }

        // Set addresses and job details based on delivery method
        const warehouseAddress = "866 Bourke Street, Waterloo";
        let jobTitle, jobAddressFull;
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            // Pickup from supplier
            jobTitle = `${supplierName} - Pickup`;
            jobAddressFull = supplierAddress || supplierName;
            originAddress = supplierAddress || supplierName;
            destinationAddress = warehouseAddress;
        } else {
            // Delivery to warehouse
            jobTitle = `${supplierName} - Delivery`;
            jobAddressFull = warehouseAddress;
            originAddress = supplierAddress || supplierName;
            destinationAddress = warehouseAddress;
        }

        // Generate job number using shared utility
        const jobNumber = await generateJobNumber(base44, po.project_id);

        // Create the Job
        const jobData = {
            job_number: jobNumber,
            job_type_id: jobTypeId,
            job_type: jobTypeName,
            job_type_name: jobTypeName,
            project_id: po.project_id || null,
            purchase_order_id: po.id,
            status: "Open",
            scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
            assigned_to: technician_id ? [technician_id] : [],
            notes: `Logistics job for PO from ${supplierName}`,
            address: jobAddressFull,
            address_full: jobAddressFull,
            customer_name: jobTitle,
            is_logistics_job: true,
            logistics_purpose: logisticsPurpose,
            origin_address: originAddress,
            destination_address: destinationAddress,
        };

        const job = await base44.asServiceRole.entities.Job.create(jobData);

        // Update PO with linked job reference
        const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
            linked_logistics_job_id: job.id
        });

        // Get existing Parts on this PO
        const parts = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: po.id
        });

        // Get PO lines to ensure we have Parts for all line items
        const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
            purchase_order_id: po.id
        });

        // Create Parts from PO lines if they don't exist
        const existingPartsByLineId = new Map();
        for (const part of parts) {
            if (part.part_id) {
                existingPartsByLineId.set(part.part_id, part);
            }
        }

        const allParts = [...parts];
        for (const line of poLines) {
            // Check if we already have a Part for this line
            if (line.part_id && existingPartsByLineId.has(line.part_id)) {
                // Part exists, but ensure item_name is populated from PO line
                const part = existingPartsByLineId.get(line.part_id);
                if (!part.item_name && line.item_name) {
                    await base44.asServiceRole.entities.Part.update(part.id, {
                        item_name: line.item_name
                    });
                    part.item_name = line.item_name;
                }
                continue;
            }

            // No Part exists for this line - create one
            const newPart = await base44.asServiceRole.entities.Part.create({
                project_id: po.project_id || null,
                item_name: line.item_name || line.description || 'Item',
                category: "Other",
                quantity_required: line.qty_ordered || 1,
                status: "on_order",
                location: "supplier",
                purchase_order_id: po.id,
                supplier_id: po.supplier_id,
                supplier_name: po.supplier_name,
                po_number: po.po_reference,
                order_reference: po.po_reference,
                order_date: po.order_date,
                eta: po.expected_date,
            });
            allParts.push(newPart);

            // Update the PO line with the new part_id
            await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
                part_id: newPart.id
            });
        }

        // Build checked_items object for the job
        const checkedItems = {};
        for (const part of allParts) {
            checkedItems[part.id] = false;

            const currentLinks = Array.isArray(part.linked_logistics_jobs) ? part.linked_logistics_jobs : [];
            if (!currentLinks.includes(job.id)) {
                await base44.asServiceRole.entities.Part.update(part.id, {
                    linked_logistics_jobs: [...currentLinks, job.id]
                });
            }
        }

        // Update job with checked_items
        const updatedJob = await base44.asServiceRole.entities.Job.update(job.id, {
            checked_items: checkedItems
        });

        return Response.json({
            success: true,
            job: updatedJob,
            purchaseOrder: updatedPO
        });

    } catch (error) {
        console.error('Error creating logistics job for PO:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});