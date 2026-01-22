import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const url = new URL(req.url);
        const dryRun = url.searchParams.get('dryRun') === 'true';

        // Fetch all completed jobs
        const completedJobs = await base44.asServiceRole.entities.Job.filter({
            status: 'Completed'
        });

        console.log(`[backfillJobLineItemUsage] Found ${completedJobs.length} completed jobs (dryRun: ${dryRun})`);

        let processedCount = 0;
        let skippedCount = 0;

        for (const job of completedJobs) {
            // Skip logistics jobs
            if (job.is_logistics_job === true) {
                skippedCount++;
                continue;
            }

            // Check if already processed
            const existingMovements = await base44.asServiceRole.entities.StockMovement.filter({
                job_id: job.id,
                source: 'job_completion_usage'
            });

            if (existingMovements.length > 0) {
                console.log(`[backfillJobLineItemUsage] Job ${job.id} already processed - skipping`);
                skippedCount++;
                continue;
            }

            // Fetch LineItems for this job
            const lineItems = await base44.asServiceRole.entities.LineItem.filter({
                job_id: job.id
            });

            if (lineItems.length === 0) {
                skippedCount++;
                continue;
            }

            try {
                // Create StockMovement for each LineItem
                for (const item of lineItems) {
                    const quantity = item.quantity || 1;
                    if (quantity <= 0) continue;

                    if (!dryRun) {
                        await base44.asServiceRole.entities.StockMovement.create({
                            job_id: job.id,
                            project_id: job.project_id,
                            sku_id: item.price_list_item_id,
                            item_name: item.item_name,
                            quantity,
                            movement_type: 'job_usage',
                            from_location_name: 'Vehicle',
                            performed_by_user_id: user.id,
                            performed_by_user_email: user.email,
                            performed_by_user_name: user.full_name || user.display_name,
                            performed_at: new Date().toISOString(),
                            source: 'job_completion_usage',
                            notes: `[Backfill] Used in job #${job.job_number} completion`
                        });
                    }
                }

                processedCount++;
                console.log(`[backfillJobLineItemUsage] ${dryRun ? '[DRY RUN] Would process' : 'Processed'} job ${job.id} (${lineItems.length} items)`);
            } catch (error) {
                console.error(`[backfillJobLineItemUsage] Error processing job ${job.id}:`, error);
            }
        }

        return Response.json({
            success: true,
            processed: processedCount,
            skipped: skippedCount,
            total: completedJobs.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});