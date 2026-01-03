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
                // Only process jobs with purchase orders
                if (!job.purchase_order_id) {
                    console.log(`Skipping job ${job.id} - no purchase order`);
                    skipped++;
                    continue;
                }
                
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