import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Get the job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    
    if (!job.purchase_order_id) {
      return Response.json({ error: 'Job has no purchase order' }, { status: 400 });
    }

    // Get all parts for this PO
    const parts = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id: job.purchase_order_id
    });

    console.log(`Found ${parts.length} parts for PO ${job.purchase_order_id}`);

    // Group by item_name to find duplicates
    const partsByName = {};
    for (const part of parts) {
      const key = part.item_name || 'unnamed';
      if (!partsByName[key]) {
        partsByName[key] = [];
      }
      partsByName[key].push(part);
    }

    const deletedParts = [];
    
    // For each duplicate group, keep the oldest one and delete the rest
    for (const [itemName, duplicates] of Object.entries(partsByName)) {
      if (duplicates.length > 1) {
        // Sort by created_date, keep the oldest
        duplicates.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const toKeep = duplicates[0];
        const toDelete = duplicates.slice(1);

        console.log(`Item "${itemName}": keeping ${toKeep.id}, deleting ${toDelete.length} duplicates`);

        for (const part of toDelete) {
          await base44.asServiceRole.entities.Part.delete(part.id);
          deletedParts.push({
            id: part.id,
            item_name: part.item_name,
            created_date: part.created_date
          });
        }
      }
    }

    // Update the job's checked_items to only include remaining parts
    const remainingParts = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id: job.purchase_order_id
    });

    const newCheckedItems = {};
    for (const part of remainingParts) {
      newCheckedItems[part.id] = job.checked_items?.[part.id] || false;
    }

    await base44.asServiceRole.entities.Job.update(job_id, {
      checked_items: newCheckedItems
    });

    return Response.json({
      success: true,
      deleted_count: deletedParts.length,
      deleted_parts: deletedParts,
      remaining_parts: remainingParts.length,
      updated_checked_items: newCheckedItems
    });

  } catch (error) {
    console.error('Error cleaning up duplicate parts:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});