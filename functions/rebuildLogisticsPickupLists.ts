import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Starting logistics pickup list rebuild...');

    // Get all logistics jobs with purchase orders
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const logisticsJobs = allJobs.filter(job => 
      job.is_logistics_job && job.purchase_order_id
    );

    console.log(`Found ${logisticsJobs.length} logistics jobs with POs`);

    let rebuiltCount = 0;

    for (const job of logisticsJobs) {
      try {
        // Get the actual PO lines
        const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
          purchase_order_id: job.purchase_order_id
        });

        if (poLines.length === 0) {
          console.log(`Job ${job.id}: No PO lines found`);
          continue;
        }

        // Rebuild checked_items with correct line IDs
        const newCheckedItems = {};
        poLines.forEach(line => {
          newCheckedItems[line.id] = job.checked_items?.[line.id] || false;
        });

        // Only update if different from current
        const currentKeys = Object.keys(job.checked_items || {}).sort().join(',');
        const newKeys = Object.keys(newCheckedItems).sort().join(',');

        if (currentKeys !== newKeys) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            checked_items: newCheckedItems
          });
          rebuiltCount++;
          console.log(`Rebuilt job ${job.job_number}: ${poLines.length} items`);
        }
      } catch (err) {
        console.error(`Failed to process job ${job.id}:`, err.message);
      }
    }

    console.log('Rebuild complete');
    return Response.json({
      success: true,
      rebuiltCount,
      message: `Rebuilt ${rebuiltCount} logistics pickup lists`
    });

  } catch (error) {
    console.error('Rebuild error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});