import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all logistics jobs with purchase orders
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      is_logistics_job: true,
      purchase_order_id: { $exists: true, $ne: null }
    });

    console.log(`Checking ${allJobs.length} logistics jobs for duplicate parts`);

    const jobsWithDuplicates = [];

    for (const job of allJobs) {
      // Get all parts for this PO
      const parts = await base44.asServiceRole.entities.Part.filter({
        purchase_order_id: job.purchase_order_id
      });

      // Group by item_name to find duplicates
      const partsByName = {};
      for (const part of parts) {
        const key = part.item_name || 'unnamed';
        if (!partsByName[key]) {
          partsByName[key] = [];
        }
        partsByName[key].push(part);
      }

      // Check for duplicates
      const duplicateGroups = [];
      for (const [itemName, duplicates] of Object.entries(partsByName)) {
        if (duplicates.length > 1) {
          duplicateGroups.push({
            item_name: itemName,
            count: duplicates.length,
            part_ids: duplicates.map(p => p.id)
          });
        }
      }

      if (duplicateGroups.length > 0) {
        jobsWithDuplicates.push({
          job_id: job.id,
          job_number: job.job_number,
          purchase_order_id: job.purchase_order_id,
          total_parts: parts.length,
          duplicate_groups: duplicateGroups
        });
      }
    }

    return Response.json({
      total_jobs_checked: allJobs.length,
      jobs_with_duplicates: jobsWithDuplicates.length,
      details: jobsWithDuplicates
    });

  } catch (error) {
    console.error('Error finding jobs with duplicate parts:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});