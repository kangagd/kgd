import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const LOGISTICS_JOB_TYPE_NAME = "Logistics";

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

const PART_LOCATION = {
    SUPPLIER: "supplier",
    DELIVERY_BAY: "delivery_bay",
    WAREHOUSE_STORAGE: "warehouse_storage",
    VEHICLE: "vehicle",
    CLIENT_SITE: "client_site",
};

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

        // Determine origin and destination based on delivery method
        let origin, destination;
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            origin = PART_LOCATION.SUPPLIER;
            destination = PART_LOCATION.WAREHOUSE_STORAGE;
        } else {
            // Default to DELIVERY
            origin = PART_LOCATION.SUPPLIER;
            destination = PART_LOCATION.DELIVERY_BAY;
        }

        // Find or create JobType based on delivery method
        const jobTypeName = po.delivery_method === PO_DELIVERY_METHOD.PICKUP 
            ? "Material Pickup - Supplier" 
            : "Material Delivery - Warehouse";
            
        let jobTypes = await base44.asServiceRole.entities.JobType.filter({ 
            name: jobTypeName 
        });
        let jobTypeId;

        if (jobTypes.length > 0) {
            jobTypeId = jobTypes[0].id;
        } else {
            // Create the job type if it doesn't exist
            const newJobType = await base44.asServiceRole.entities.JobType.create({
                name: jobTypeName,
                description: po.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                    ? "Pick up materials from supplier location"
                    : "Receive delivery at warehouse location",
                color: "#8B5CF6",
                estimated_duration: 2,
                is_active: true,
                is_logistics: true
            });
            jobTypeId = newJobType.id;
        }

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

        // Set job title and address based on delivery method
        let jobTitle, jobAddressFull;
        const warehouseAddress = "866 Bourke Street, Waterloo";
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            // Material Pick Up from Supplier
            jobTitle = `${supplierName} - Pickup`;
            jobAddressFull = supplierAddress || supplierName;
        } else {
            // Material Delivery to Warehouse
            jobTitle = `${supplierName} - Delivery`;
            jobAddressFull = warehouseAddress;
        }

        // Generate job number - use manageJob to ensure proper numbering
        let jobNumber;
        if (po.project_id) {
            // Project job - use project number with alpha suffix
            const project = await base44.asServiceRole.entities.Project.get(po.project_id);
            const projectNumber = project.project_number;
            
            // Find existing jobs for this project to determine next suffix
            const projectJobs = await base44.asServiceRole.entities.Job.filter({ 
                project_id: po.project_id 
            });
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const suffix = alphabet[projectJobs.length] || `Z${projectJobs.length - 25}`;
            
            jobNumber = `${projectNumber}-${suffix}`;
        } else {
            // Standalone job - use unique number
            const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 1);
            const allProjects = await base44.asServiceRole.entities.Project.list('-project_number', 1);
            
            // Find highest number used across both projects and standalone jobs
            let highestNumber = 4999;
            
            if (allProjects.length > 0 && allProjects[0].project_number) {
                highestNumber = Math.max(highestNumber, allProjects[0].project_number);
            }
            
            // Check existing standalone job numbers
            const standaloneJobs = allJobs.filter(j => !j.project_id && typeof j.job_number === 'string' && !j.job_number.includes('-'));
            for (const sj of standaloneJobs) {
                const num = parseInt(sj.job_number);
                if (!isNaN(num)) {
                    highestNumber = Math.max(highestNumber, num);
                }
            }
            
            jobNumber = String(highestNumber + 1);
        }

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
            notes: `Logistics job for PO from ${supplierName}\nOrigin: ${origin}\nDestination: ${destination}`,
            address: jobAddressFull,
            address_full: jobAddressFull,
            customer_name: jobTitle,
        };

        const job = await base44.asServiceRole.entities.Job.create(jobData);

        // Update PO with linked job reference
        const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
            linked_logistics_job_id: job.id
        });

        // Link job to all Parts on this PO
        const parts = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: po.id
        });

        for (const part of parts) {
            const currentLinks = Array.isArray(part.linked_logistics_jobs) ? part.linked_logistics_jobs : [];
            if (!currentLinks.includes(job.id)) {
                await base44.asServiceRole.entities.Part.update(part.id, {
                    linked_logistics_jobs: [...currentLinks, job.id]
                });
            }
        }

        return Response.json({
            success: true,
            job,
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