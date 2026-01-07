import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Starting logistics pickup cleanup...');

    // Get all jobs (logistics jobs have checked_items field)
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const logisticsJobs = allJobs.filter(job => 
      job.checked_items && Object.keys(job.checked_items).length > 0
    );

    console.log(`Found ${logisticsJobs.length} logistics jobs with pickup items`);

    let cleanedCount = 0;
    let totalDuplicatesRemoved = 0;

    for (const job of logisticsJobs) {
      try {
        const itemIds = Object.keys(job.checked_items);
        const uniqueItems = {};
        const seenItems = new Set();
        let hasDuplicates = false;

        // Fetch all PO line items to check for duplicates
        const items = await Promise.all(
          itemIds.map(id => 
            base44.asServiceRole.entities.PurchaseOrderLine.get(id).catch(() => null)
          )
        );

        // Group by item content (item_name + quantity)
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemId = itemIds[i];
          
          if (!item) {
            // Item doesn't exist, remove from checked_items
            hasDuplicates = true;
            continue;
          }

          const itemKey = `${item.item_name}_${item.quantity}`;
          
          if (seenItems.has(itemKey)) {
            // Duplicate found
            hasDuplicates = true;
            totalDuplicatesRemoved++;
            console.log(`Found duplicate for job ${job.id}: ${item.item_name}`);
          } else {
            seenItems.add(itemKey);
            uniqueItems[itemId] = job.checked_items[itemId];
          }
        }

        if (hasDuplicates) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            checked_items: uniqueItems
          });
          cleanedCount++;
          console.log(`Cleaned job ${job.id}, removed ${itemIds.length - Object.keys(uniqueItems).length} duplicates`);
        }
      } catch (err) {
        console.error(`Failed to process job ${job.id}:`, err.message);
      }
    }

    console.log('Cleanup complete');
    return Response.json({
      success: true,
      cleanedJobs: cleanedCount,
      duplicatesRemoved: totalDuplicatesRemoved,
      message: `Cleaned ${cleanedCount} jobs, removed ${totalDuplicatesRemoved} duplicate items`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});