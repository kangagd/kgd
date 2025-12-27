import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all logistics jobs with purchase orders
        const logisticsJobs = await base44.asServiceRole.entities.Job.filter({
            purchase_order_id: { $ne: null }
        });

        console.log(`Found ${logisticsJobs.length} logistics jobs to process`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const job of logisticsJobs) {
            try {
                // Get the PO
                const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
                if (!po) {
                    console.log(`PO not found for job ${job.id}`);
                    skipped++;
                    continue;
                }

                let jobAddress;

                if (po.delivery_method === PO_DELIVERY_METHOD.PICKUP) {
                    // For pickup, get supplier address
                    if (po.supplier_id) {
                        try {
                            const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                            jobAddress = supplier?.pickup_address || supplier?.address_full || supplier?.address_street || po.supplier_name || "Supplier address not set";
                        } catch (error) {
                            console.error(`Error fetching supplier for job ${job.id}:`, error);
                            jobAddress = po.supplier_name || "Supplier address not set";
                        }
                    } else {
                        jobAddress = po.supplier_name || "Supplier address not set";
                    }
                } else {
                    // For delivery (or unspecified), use warehouse address
                    jobAddress = "866 Bourke Street, Waterloo";
                }

                // Update the job
                await base44.asServiceRole.entities.Job.update(job.id, {
                    address: jobAddress,
                    address_full: jobAddress
                });

                console.log(`Updated job ${job.id} with address: ${jobAddress}`);
                updated++;

            } catch (error) {
                console.error(`Error processing job ${job.id}:`, error);
                errors++;
            }
        }

        return Response.json({
            success: true,
            total: logisticsJobs.length,
            updated,
            skipped,
            errors,
            message: `Backfill complete. Updated ${updated} jobs, skipped ${skipped}, errors ${errors}`
        });

    } catch (error) {
        console.error('Error in backfill:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});