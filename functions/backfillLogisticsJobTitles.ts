import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Allow admins, managers, or targeted job_ids parameter
        const { job_ids } = await req.json().catch(() => ({}));
        const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
        
        if (!isAdminOrManager && !job_ids) {
            return Response.json({ error: 'Unauthorized - Admin/Manager only' }, { status: 401 });
        }

        console.log('Starting logistics job titles backfill...');
        
        // Find all logistics job types
        const logisticsJobTypes = await base44.asServiceRole.entities.JobType.filter({ is_logistics: true });
        const logisticsJobTypeIds = logisticsJobTypes.map(jt => jt.id);
        
        console.log(`Found ${logisticsJobTypes.length} logistics job types`);
        
        // Get jobs - either specific ones or all logistics jobs
        let logisticsJobs;
        if (job_ids && Array.isArray(job_ids) && job_ids.length > 0) {
            // Specific jobs requested
            logisticsJobs = await Promise.all(
                job_ids.map(id => base44.asServiceRole.entities.Job.get(id).catch(() => null))
            );
            logisticsJobs = logisticsJobs.filter(j => j !== null);
        } else {
            // All logistics jobs
            const allJobs = await base44.asServiceRole.entities.Job.list();
            logisticsJobs = allJobs.filter(job => 
                (job.job_type_id && logisticsJobTypeIds.includes(job.job_type_id)) ||
                job.purchase_order_id
            );
        }
        
        console.log(`Found ${logisticsJobs.length} logistics jobs to process`);
        
        let updated = 0;
        let skipped = 0;
        const errors = [];
        
        for (const job of logisticsJobs) {
            try {
                let jobTitle, jobAddress;
                const warehouseAddress = "866 Bourke Street, Waterloo";
                const jobTypeName = (job.job_type_name || job.job_type || '').toLowerCase();
                
                // Skip sample logistics - they're project-specific
                if (jobTypeName.includes('sample')) {
                    console.log(`Skipping sample logistics job ${job.id} - keeping project-specific details`);
                    skipped++;
                    continue;
                }
                
                // Determine based on job type name
                if (jobTypeName.includes('warehouse')) {
                    // Material Pick Up - Warehouse OR Material Delivery - Warehouse
                    jobTitle = "Warehouse";
                    jobAddress = warehouseAddress;
                } else if (jobTypeName.includes('supplier') || (jobTypeName.includes('pickup') || jobTypeName.includes('pick up') || jobTypeName.includes('pick-up'))) {
                    // Material Pick Up - Supplier
                    // Get supplier details from PO if available
                    if (job.purchase_order_id) {
                        const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
                        if (po && po.supplier_id) {
                            try {
                                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                                if (supplier) {
                                    jobTitle = supplier.name;
                                    jobAddress = supplier.pickup_address || supplier.address_full || supplier.address_street || supplier.name;
                                }
                            } catch (error) {
                                console.error(`Error fetching supplier for job ${job.id}:`, error);
                            }
                        }
                    }
                    
                    // Fallback if no supplier found
                    if (!jobTitle) {
                        jobTitle = "Supplier";
                        jobAddress = "Supplier Address";
                    }
                } else if (jobTypeName.includes('delivery') || jobTypeName.includes('stock')) {
                    // Stock Delivery OR Material Delivery (without warehouse/supplier specified)
                    jobTitle = "Warehouse";
                    jobAddress = warehouseAddress;
                } else {
                    // Other logistics types - keep existing
                    console.log(`Skipping job ${job.id} - unrecognized logistics type: ${jobTypeName}`);
                    skipped++;
                    continue;
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