import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        console.log('Starting logistics job titles backfill...');
        
        // Find all logistics job types
        const logisticsJobTypes = await base44.asServiceRole.entities.JobType.filter({ is_logistics: true });
        const logisticsJobTypeIds = logisticsJobTypes.map(jt => jt.id);
        
        console.log(`Found ${logisticsJobTypes.length} logistics job types`);
        
        // Get all jobs that are logistics
        const allJobs = await base44.asServiceRole.entities.Job.list();
        const logisticsJobs = allJobs.filter(job => 
            (job.job_type_id && logisticsJobTypeIds.includes(job.job_type_id)) ||
            job.purchase_order_id
        );
        
        console.log(`Found ${logisticsJobs.length} logistics jobs to process`);
        
        let updated = 0;
        let skipped = 0;
        const errors = [];
        
        for (const job of logisticsJobs) {
            try {
                let jobTitle, jobAddress;
                const warehouseAddress = "866 Bourke Street, Waterloo";
                
                // Check if this is a PO-based logistics job
                if (job.purchase_order_id) {
                    // Get the purchase order
                    const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
                    if (!po) {
                        console.log(`Skipping job ${job.id} - PO not found`);
                        skipped++;
                        continue;
                    }
                    
                    // Get supplier details
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
                            console.error(`Error fetching supplier for job ${job.id}:`, error);
                        }
                    }
                    
                    // Determine title and address based on delivery method
                    if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
                        // Material Pick Up from Supplier
                        jobTitle = supplierName;
                        jobAddress = supplierAddress || supplierName;
                    } else {
                        // Material Delivery to Warehouse
                        jobTitle = "Warehouse";
                        jobAddress = warehouseAddress;
                    }
                } else {
                    // Non-PO logistics job - determine based on job type name
                    const jobTypeName = (job.job_type_name || job.job_type || '').toLowerCase();
                    
                    if (jobTypeName.includes('pickup') || jobTypeName.includes('pick up') || jobTypeName.includes('pick-up')) {
                        // Pickup job - try to determine location from existing data
                        if (job.location_id) {
                            try {
                                const location = await base44.asServiceRole.entities.InventoryLocation.get(job.location_id);
                                if (location) {
                                    jobTitle = location.name;
                                    jobAddress = location.address || location.name;
                                }
                            } catch (error) {
                                console.error(`Error fetching location for job ${job.id}:`, error);
                            }
                        }
                        
                        if (!jobTitle) {
                            // Check if there's a supplier reference or use existing address
                            jobTitle = job.customer_name || "Pickup Location";
                            jobAddress = job.address_full || job.address || jobTitle;
                        }
                    } else if (jobTypeName.includes('delivery') || jobTypeName.includes('stock')) {
                        // Delivery job - default to Warehouse
                        jobTitle = "Warehouse";
                        jobAddress = warehouseAddress;
                    } else if (jobTypeName.includes('sample')) {
                        // Sample logistics - keep existing customer/address (project-specific)
                        console.log(`Skipping sample logistics job ${job.id} - keeping project-specific details`);
                        skipped++;
                        continue;
                    } else {
                        // Other logistics types - keep existing
                        console.log(`Skipping job ${job.id} - unrecognized logistics type: ${jobTypeName}`);
                        skipped++;
                        continue;
                    }
                }
                
                // Update the job
                await base44.asServiceRole.entities.Job.update(job.id, {
                    customer_name: jobTitle,
                    address: jobAddress,
                    address_full: jobAddress
                });
                
                console.log(`Updated job ${job.id}: "${jobTitle}" at ${jobAddress}`);
                updated++;
                
            } catch (error) {
                console.error(`Error processing job ${job.id}:`, error);
                errors.push({ job_id: job.id, error: error.message });
            }
        }
        
        console.log('Backfill complete');
        
        return Response.json({
            success: true,
            total: logisticsJobs.length,
            updated,
            skipped,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Backfill error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});