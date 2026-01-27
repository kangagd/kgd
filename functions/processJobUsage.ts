import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, mode = 'deduct', notes = '' } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // A) Fetch job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // D) Idempotency check
    if (job.stock_usage_status === 'completed') {
      return Response.json({
        success: true,
        skipped_message: 'Stock usage already completed for this job',
        deducted_count: 0,
        skipped_count: 0,
        skipped_lines: []
      });
    }

    // Permission check: technician can only deduct from their own vehicle (or admin override)
    const isAdmin = user.role === 'admin';
    const isTechnicianOrAdmin = isAdmin || user.extended_role === 'technician' || user.is_field_technician === true;

    if (!isTechnicianOrAdmin) {
      return Response.json({ error: 'Only technicians or admins can deduct inventory' }, { status: 403 });
    }

    // B) Resolve technician's assigned vehicle
    let assignedVehicle = null;
    if (!isAdmin) {
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ 
        assigned_user_id: user.id, 
        is_active: { $ne: false }
      });
      
      if (!vehicles || vehicles.length === 0) {
        return Response.json({ 
          error: 'No assigned vehicle found for this technician' 
        }, { status: 409 });
      }
      if (vehicles.length > 1) {
        return Response.json({ 
          error: 'Multiple assigned vehicles found; cannot determine deduction source' 
        }, { status: 409 });
      }
      assignedVehicle = vehicles[0];
    } else {
      // For admin, determine vehicle from job assignment or last check-in
      // If job has assigned_to, use first technician's vehicle
      if (job.assigned_to && job.assigned_to.length > 0) {
        const techs = await base44.asServiceRole.entities.User.filter({ 
          email: job.assigned_to[0]
        });
        if (techs && techs.length > 0) {
          const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ 
            assigned_user_id: techs[0].id, 
            is_active: { $ne: false }
          });
          assignedVehicle = vehicles?.[0];
        }
      }
      
      if (!assignedVehicle) {
        return Response.json({ 
          error: 'Admin: cannot determine vehicle from job assignment' 
        }, { status: 409 });
      }
    }

    // C) Resolve vehicle InventoryLocation
    const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'vehicle',
      vehicle_id: assignedVehicle.id,
      is_active: { $ne: false }
    });

    if (!vehicleLocations || vehicleLocations.length === 0) {
      return Response.json({ 
        error: 'Vehicle location not found or not active' 
      }, { status: 409 });
    }

    const vehicleLocation = vehicleLocations[0];

    // E) Fetch items used for this job (via ProjectCost or LineItem if available)
    let jobItems = [];
    
    if (job.project_id) {
      // Fetch line items linked to this job (if using LineItem entity)
      try {
        const lineItems = await base44.asServiceRole.entities.LineItem.filter({
          job_id: job_id
        });
        jobItems = lineItems || [];
      } catch (err) {
        // LineItem might not exist; continue
      }
    }

    // F) Batch validate all items
    const validItems = [];
    const skippedLines = [];

    for (const item of jobItems) {
      // Skip if no price_list_item_id
      if (!item.price_list_item_id) {
        skippedLines.push({
          item_name: item.item_name,
          quantity: item.quantity,
          reason: 'cost_only'
        });
        continue;
      }

      // Fetch PriceListItem
      let priceListItem;
      try {
        priceListItem = await base44.asServiceRole.entities.PriceListItem.get(item.price_list_item_id);
      } catch (err) {
        skippedLines.push({
          item_name: item.item_name,
          quantity: item.quantity,
          reason: 'price_list_item_not_found'
        });
        continue;
      }

      // Skip if not tracked
      if (priceListItem.track_inventory !== true) {
        skippedLines.push({
          item_name: item.item_name,
          quantity: item.quantity,
          reason: 'not_tracked'
        });
        continue;
      }

      // Check stock availability
      let inventoryQty;
      try {
        const qtyRecords = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: item.price_list_item_id,
          location_id: vehicleLocation.id
        });
        inventoryQty = qtyRecords?.[0];
      } catch (err) {
        // No inventory record yet
        inventoryQty = null;
      }

      const currentQty = inventoryQty?.quantity || 0;
      if (currentQty < item.quantity) {
        skippedLines.push({
          item_name: item.item_name,
          quantity: item.quantity,
          available: currentQty,
          reason: 'insufficient_stock'
        });
        continue;
      }

      // Valid item
      validItems.push({
        item_id: item.id,
        price_list_item_id: item.price_list_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        priceListItem
      });
    }

    // G) If dry_run, return report
    if (mode === 'dry_run') {
      return Response.json({
        success: true,
        dry_run: true,
        deducted_count: validItems.length,
        skipped_count: skippedLines.length,
        skipped_lines: skippedLines,
        would_deduct: validItems.map(v => ({
          item_name: v.item_name,
          quantity: v.quantity
        }))
      });
    }

    // H) If mode='deduct', execute mutations
    if (mode === 'deduct') {
      const deductionNotes = notes || 'Job usage deduction';
      
      for (const item of validItems) {
        try {
          await base44.asServiceRole.integrations.InventoryCore.moveInventory({
            priceListItemId: item.price_list_item_id,
            fromLocationId: vehicleLocation.id,
            toLocationId: null, // Deduction (no destination)
            quantity: item.quantity,
            source: 'job_usage',
            jobId: job_id,
            notes: deductionNotes
          });
        } catch (err) {
          console.error(`[processJobUsage] Failed to deduct ${item.item_name}:`, err);
          // Don't fail entire job; add to skipped
          skippedLines.push({
            item_name: item.item_name,
            quantity: item.quantity,
            reason: 'deduction_error',
            error: err.message
          });
        }
      }

      // Update Job status
      try {
        await base44.asServiceRole.entities.Job.update(job_id, {
          stock_usage_status: 'completed',
          stock_usage_completed_at: new Date().toISOString(),
          stock_usage_completed_by: user.email
        });
      } catch (err) {
        console.error('[processJobUsage] Failed to update job status:', err);
      }

      return Response.json({
        success: true,
        deducted_count: validItems.length,
        skipped_count: skippedLines.length,
        skipped_lines: skippedLines
      });
    }

    return Response.json({ 
      error: `Unknown mode: ${mode}` 
    }, { status: 400 });

  } catch (error) {
    console.error('[processJobUsage] Error:', error);
    return Response.json({ 
      error: 'Failed to process job usage',
      details: error.message 
    }, { status: 500 });
  }
});