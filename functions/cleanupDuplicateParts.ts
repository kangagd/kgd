import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { purchase_order_id, keep_part_id } = await req.json();

    if (!purchase_order_id) {
      return Response.json({ 
        error: 'purchase_order_id is required' 
      }, { status: 400 });
    }

    // Get all parts for this PO
    const parts = await base44.asServiceRole.entities.Part.filter({
      purchase_order_id
    });

    if (parts.length <= 1) {
      return Response.json({
        success: true,
        message: 'No duplicates found',
        deleted: 0
      });
    }

    // Determine which part to keep
    let partToKeep;
    if (keep_part_id) {
      partToKeep = parts.find(p => p.id === keep_part_id);
    } else {
      // Keep the oldest part created by a real user (not service)
      partToKeep = parts
        .filter(p => !p.created_by.includes('service+'))
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      
      // If no user-created parts, keep the oldest one
      if (!partToKeep) {
        partToKeep = parts.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      }
    }

    if (!partToKeep) {
      return Response.json({ 
        error: 'Could not determine which part to keep' 
      }, { status: 400 });
    }

    // Delete all other parts
    const partsToDelete = parts.filter(p => p.id !== partToKeep.id);
    let deleted = 0;

    for (const part of partsToDelete) {
      await base44.asServiceRole.entities.Part.delete(part.id);
      deleted++;
    }

    // Update PO line to point to the kept part
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id
    });

    for (const line of poLines) {
      if (!line.part_id || line.part_id !== partToKeep.id) {
        await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
          part_id: partToKeep.id
        });
      }
    }

    // Update job checked_items to only include the kept part
    if (partToKeep.linked_logistics_jobs && partToKeep.linked_logistics_jobs.length > 0) {
      for (const jobId of partToKeep.linked_logistics_jobs) {
        const job = await base44.asServiceRole.entities.Job.get(jobId);
        await base44.asServiceRole.entities.Job.update(jobId, {
          checked_items: { [partToKeep.id]: job.checked_items?.[partToKeep.id] || false }
        });
      }
    }

    return Response.json({
      success: true,
      deleted,
      kept_part_id: partToKeep.id,
      message: `Deleted ${deleted} duplicate parts, kept ${partToKeep.id}`
    });
  } catch (error) {
    console.error('Error cleaning up duplicate parts:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});