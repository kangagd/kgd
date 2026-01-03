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
        let origin, destination, jobAddress;
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            origin = PART_LOCATION.SUPPLIER;
            destination = PART_LOCATION.WAREHOUSE_STORAGE;
        } else {
            // Default to DELIVERY
            origin = PART_LOCATION.SUPPLIER;
            destination = PART_LOCATION.DELIVERY_BAY;
        }

        // Find or create JobType for Logistics
        let logisticsJobTypes = await base44.asServiceRole.entities.JobType.filter({ 
            name: LOGISTICS_JOB_TYPE_NAME 
        });
        let jobTypeId;

        if (logisticsJobTypes.length > 0) {
            jobTypeId = logisticsJobTypes[0].id;
        } else {
            // Create the Logistics job type if it doesn't exist
            const newJobType = await base44.asServiceRole.entities.JobType.create({
                name: LOGISTICS_JOB_TYPE_NAME,
                description: "Logistics job for managing deliveries and pickups",
                color: "#8B5CF6",
                estimated_duration: 2,
                is_active: true
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
        let jobTitle, jobAddress;
        const warehouseAddress = "866 Bourke Street, Waterloo";
        
        if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
            // Material Pick Up from Supplier
            jobTitle = supplierName;
            jobAddress = supplierAddress || supplierName;
        } else {
            // Material Delivery to Warehouse
            jobTitle = "Warehouse";
            jobAddress = warehouseAddress;
        }

        // Create the Job
        const jobData = {
            job_type_id: jobTypeId,
            job_type: LOGISTICS_JOB_TYPE_NAME,
            job_type_name: LOGISTICS_JOB_TYPE_NAME,
            project_id: po.project_id || null,
            purchase_order_id: po.id,
            status: "Open",
            scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
            assigned_to: technician_id ? [technician_id] : [],
            notes: `Logistics job for PO from ${supplierName}\nOrigin: ${origin}\nDestination: ${destination}`,
            address: jobAddress,
            address_full: jobAddress,
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