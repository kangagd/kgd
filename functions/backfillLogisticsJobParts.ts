import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { job_id } = await req.json();

    // Get specific job or all logistics jobs with PO
    const jobs = job_id 
      ? [await base44.asServiceRole.entities.Job.get(job_id)]
      : await base44.asServiceRole.entities.Job.filter({ 
          purchase_order_id: { $exists: true, $ne: null } 
        });

    let processed = 0;
    let updated = 0;

    for (const job of jobs) {
      if (!job.purchase_order_id) continue;
      
      processed++;

      // Get PO and its lines
      let po;
      try {
        po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
      } catch (error) {
        console.error(`PO ${job.purchase_order_id} not found for job ${job.id}:`, error);
        continue;
      }

      const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
        purchase_order_id: po.id
      });

      // Get existing Parts
      const existingParts = await base44.asServiceRole.entities.Part.filter({
        purchase_order_id: po.id
      });

      // Map existing parts by PO line ID
      const existingPartsByLineId = new Map();
      
      // First pass: map parts that are already linked to PO lines via part_id
      for (const line of poLines) {
        if (line.part_id) {
          const linkedPart = existingParts.find(p => p.id === line.part_id);
          if (linkedPart) {
            existingPartsByLineId.set(line.id, linkedPart);
          }
        }
      }
      
      // Second pass: for lines without part_id, try to match by item_name
      for (const line of poLines) {
        if (!existingPartsByLineId.has(line.id) && line.item_name) {
          const matchingPart = existingParts.find(p => 
            p.item_name === line.item_name && 
            !Array.from(existingPartsByLineId.values()).includes(p)
          );
          if (matchingPart) {
            existingPartsByLineId.set(line.id, matchingPart);
            // Link this part to the PO line
            await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
              part_id: matchingPart.id
            });
          }
        }
      }

      const allParts = [...existingParts];
      let createdParts = 0;

      // Create missing Parts from PO lines
      for (const line of poLines) {
        // Check if Part already exists for this line
        if (existingPartsByLineId.has(line.id)) {
          // Update item_name if missing
          const part = existingPartsByLineId.get(line.id);
          if (!part.item_name && line.item_name) {
            await base44.asServiceRole.entities.Part.update(part.id, {
              item_name: line.item_name
            });
            part.item_name = line.item_name;
          }
          continue;
        }

        // Create Part from PO line
        const newPart = await base44.asServiceRole.entities.Part.create({
          project_id: po.project_id || null,
          item_name: line.item_name || line.description || 'Item',
          category: "Other",
          quantity_required: line.qty_ordered || 1,
          status: "on_order",
          location: "supplier",
          purchase_order_id: po.id,
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name,
          po_number: po.po_reference,
          order_reference: po.po_reference,
          order_date: po.order_date,
          eta: po.expected_date,
          linked_logistics_jobs: [job.id]
        });
        allParts.push(newPart);
        createdParts++;

        // Update PO line with part_id
        await base44.asServiceRole.entities.PurchaseOrderLine.update(line.id, {
          part_id: newPart.id
        });
      }

      // Rebuild checked_items
      const checkedItems = {};
      for (const part of allParts) {
        checkedItems[part.id] = job.checked_items?.[part.id] || false;
        
        // Ensure part is linked to job
        const currentLinks = Array.isArray(part.linked_logistics_jobs) ? part.linked_logistics_jobs : [];
        if (!currentLinks.includes(job.id)) {
          await base44.asServiceRole.entities.Part.update(part.id, {
            linked_logistics_jobs: [...currentLinks, job.id]
          });
        }
      }

      // Update job
      await base44.asServiceRole.entities.Job.update(job.id, {
        checked_items: checkedItems
      });

      if (createdParts > 0) updated++;
    }

    return Response.json({
      success: true,
      processed,
      updated,
      message: `Processed ${processed} jobs, updated ${updated} with new Parts`
    });
  } catch (error) {
    console.error('Error backfilling logistics job parts:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});