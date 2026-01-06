import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Migration script to backfill logistics fields on existing Job records
 * 
 * Populates: is_logistics_job, logistics_purpose, origin_address, destination_address
 * 
 * IMPORTANT: Run with dry_run=true first to preview changes!
 */

const WAREHOUSE_ADDRESS = "866 Bourke Street, Waterloo";

const LOGISTICS_PURPOSE = {
    PO_DELIVERY_TO_WAREHOUSE: "po_delivery_to_warehouse",
    PO_PICKUP_FROM_SUPPLIER: "po_pickup_from_supplier",
    PART_PICKUP_FOR_INSTALL: "part_pickup_for_install",
    MANUAL_CLIENT_DROPOFF: "manual_client_dropoff",
    SAMPLE_DROPOFF: "sample_dropoff",
    SAMPLE_PICKUP: "sample_pickup",
};

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

/**
 * Determine logistics purpose and addresses from job context
 */
async function analyzeJob(job, base44) {
    const jobTypeName = (job.job_type_name || job.job_type || '').toLowerCase();
    
    // Already has logistics fields set
    if (job.is_logistics_job && job.logistics_purpose) {
        return { 
            shouldUpdate: false, 
            reason: 'Already has logistics fields set' 
        };
    }

    let logisticsPurpose = null;
    let originAddress = null;
    let destinationAddress = null;
    let isLogisticsJob = false;

    // 1. Purchase Order Logistics
    if (job.purchase_order_id) {
        try {
            const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
            isLogisticsJob = true;

            // Determine if pickup or delivery by checking BOTH PO delivery_method AND job type name
            const isPickup = po.delivery_method === PO_DELIVERY_METHOD.PICKUP 
                || jobTypeName.includes('pick up') 
                || jobTypeName.includes('pickup') 
                || jobTypeName.includes('pick-up')
                || jobTypeName.includes('supplier');

            if (isPickup) {
                logisticsPurpose = LOGISTICS_PURPOSE.PO_PICKUP_FROM_SUPPLIER;
                // Origin: supplier, Destination: warehouse
                if (po.supplier_id) {
                    try {
                        const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                        originAddress = supplier?.pickup_address || supplier?.address_full || supplier?.address_street || supplier?.name || "Supplier";
                    } catch {
                        originAddress = po.supplier_name || "Supplier";
                    }
                } else {
                    originAddress = po.supplier_name || "Supplier";
                }
                destinationAddress = WAREHOUSE_ADDRESS;
            } else {
                // Default to delivery
                logisticsPurpose = LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE;
                // Origin: supplier, Destination: warehouse
                if (po.supplier_id) {
                    try {
                        const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                        originAddress = supplier?.address_full || supplier?.address_street || supplier?.name || "Supplier";
                    } catch {
                        originAddress = po.supplier_name || "Supplier";
                    }
                } else {
                    originAddress = po.supplier_name || "Supplier";
                }
                destinationAddress = WAREHOUSE_ADDRESS;
            }
        } catch (error) {
            console.error(`Error analyzing PO for job ${job.id}:`, error);
        }
    }

    // 2. Sample Logistics
    if (jobTypeName.includes('sample')) {
        isLogisticsJob = true;
        
        if (jobTypeName.includes('drop') || jobTypeName.includes('delivery')) {
            logisticsPurpose = LOGISTICS_PURPOSE.SAMPLE_DROPOFF;
            originAddress = WAREHOUSE_ADDRESS;
            destinationAddress = job.address_full || job.address || "Client Site";
        } else if (jobTypeName.includes('pick') || jobTypeName.includes('collection')) {
            logisticsPurpose = LOGISTICS_PURPOSE.SAMPLE_PICKUP;
            originAddress = job.address_full || job.address || "Client Site";
            destinationAddress = WAREHOUSE_ADDRESS;
        }
    }

    // 3. Part/Material Pickup for Installation
    if (jobTypeName.includes('material') && (jobTypeName.includes('warehouse') || jobTypeName.includes('pick'))) {
        isLogisticsJob = true;
        logisticsPurpose = LOGISTICS_PURPOSE.PART_PICKUP_FOR_INSTALL;
        originAddress = WAREHOUSE_ADDRESS;
        destinationAddress = job.address_full || job.address || "Installation Site";
    }

    // 4. Check for logistics JobType flag
    if (job.job_type_id) {
        try {
            const jobType = await base44.asServiceRole.entities.JobType.get(job.job_type_id);
            if (jobType?.is_logistics) {
                isLogisticsJob = true;
                // If we don't have a purpose yet, try to infer from job type name
                if (!logisticsPurpose) {
                    if (jobTypeName.includes('delivery') || jobTypeName.includes('stock')) {
                        logisticsPurpose = LOGISTICS_PURPOSE.PO_DELIVERY_TO_WAREHOUSE;
                        originAddress = "Supplier";
                        destinationAddress = WAREHOUSE_ADDRESS;
                    }
                }
            }
        } catch (error) {
            // JobType not found, skip
        }
    }

    // 5. No logistics indicators found
    if (!isLogisticsJob) {
        return { 
            shouldUpdate: false, 
            reason: 'Not identified as logistics job' 
        };
    }

    return {
        shouldUpdate: true,
        updates: {
            is_logistics_job: true,
            logistics_purpose: logisticsPurpose,
            origin_address: originAddress,
            destination_address: destinationAddress,
        }
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Admin only
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const dryRun = body.dry_run !== false; // Default to dry run for safety
        const limitCount = body.limit || null; // Optional limit for testing

        console.log(`Starting logistics fields migration (dry_run: ${dryRun}, limit: ${limitCount || 'none'})`);

        // Fetch all jobs (we'll analyze each one)
        let allJobs = await base44.asServiceRole.entities.Job.list();
        
        // Filter out deleted jobs
        allJobs = allJobs.filter(j => !j.deleted_at);

        if (limitCount) {
            allJobs = allJobs.slice(0, limitCount);
        }

        console.log(`Analyzing ${allJobs.length} jobs...`);

        const results = {
            total: allJobs.length,
            toUpdate: 0,
            alreadySet: 0,
            notLogistics: 0,
            updated: 0,
            errors: [],
            preview: []
        };

        for (const job of allJobs) {
            try {
                const analysis = await analyzeJob(job, base44);

                if (!analysis.shouldUpdate) {
                    if (analysis.reason === 'Already has logistics fields set') {
                        results.alreadySet++;
                    } else {
                        results.notLogistics++;
                    }
                    continue;
                }

                results.toUpdate++;

                // Preview mode: collect sample changes
                if (dryRun && results.preview.length < 10) {
                    results.preview.push({
                        job_id: job.id,
                        job_number: job.job_number,
                        job_type: job.job_type_name || job.job_type,
                        current: {
                            is_logistics_job: job.is_logistics_job || false,
                            logistics_purpose: job.logistics_purpose || null,
                            origin_address: job.origin_address || null,
                            destination_address: job.destination_address || null,
                        },
                        proposed: analysis.updates
                    });
                }

                // Execute update if not dry run
                if (!dryRun) {
                    await base44.asServiceRole.entities.Job.update(job.id, analysis.updates);
                    results.updated++;
                    console.log(`Updated job ${job.id} (${job.job_number})`);
                }

            } catch (error) {
                console.error(`Error processing job ${job.id}:`, error);
                results.errors.push({
                    job_id: job.id,
                    job_number: job.job_number,
                    error: error.message
                });
            }
        }

        console.log('Migration complete');

        return Response.json({
            success: true,
            dry_run: dryRun,
            summary: {
                total_analyzed: results.total,
                already_set: results.alreadySet,
                not_logistics: results.notLogistics,
                to_update: results.toUpdate,
                actually_updated: results.updated,
                errors: results.errors.length
            },
            preview: dryRun ? results.preview : undefined,
            errors: results.errors.length > 0 ? results.errors : undefined,
            message: dryRun 
                ? `DRY RUN: Would update ${results.toUpdate} jobs. Run with {"dry_run": false} to execute.`
                : `Updated ${results.updated} jobs successfully.`
        });

    } catch (error) {
        console.error('Migration error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});