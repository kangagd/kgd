import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { stop_confirmation_id } = body;

    if (!stop_confirmation_id) {
      return Response.json({ 
        success: false, 
        error: 'stop_confirmation_id is required' 
      }, { status: 400 });
    }

    // Load StopConfirmation
    const confirmation = await base44.asServiceRole.entities.StopConfirmation.get(stop_confirmation_id);
    if (!confirmation) {
      return Response.json({ 
        success: false, 
        error: 'StopConfirmation not found' 
      }, { status: 404 });
    }

    // Load LogisticsStop
    const stop = await base44.asServiceRole.entities.LogisticsStop.get(confirmation.stop_id);
    if (!stop) {
      return Response.json({ 
        success: false, 
        error: 'LogisticsStop not found' 
      }, { status: 404 });
    }

    // Only process clear_loading_bay stops
    if (stop.purpose !== 'clear_loading_bay') {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'not_clear_loading_bay',
        stop_purpose: stop.purpose
      });
    }

    // Load receipt
    if (!stop.receipt_id) {
      return Response.json({
        success: false,
        reason: 'missing_receipt_id'
      }, { status: 400 });
    }

    const receipt = await base44.asServiceRole.entities.Receipt.get(stop.receipt_id);
    if (!receipt) {
      return Response.json({
        success: false,
        reason: 'receipt_not_found'
      }, { status: 404 });
    }

    // Load receipt lines
    const receiptLines = await base44.asServiceRole.entities.ReceiptLine.filter({
      receipt_id: receipt.id
    });

    if (receiptLines.length === 0) {
      return Response.json({
        success: true,
        created: 0,
        skipped: 0,
        reason: 'no_receipt_lines'
      });
    }

    // Determine from_location_id (Loading Bay)
    const from_location_id = receipt.location_id;
    if (!from_location_id) {
      return Response.json({
        success: false,
        reason: 'missing_from_location'
      }, { status: 400 });
    }

    // Determine to_location_id
    let to_location_id = stop.to_location_id;
    
    if (!to_location_id) {
      // Try to find a default "Main Warehouse" location
      const warehouseLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
        name: 'Main Warehouse'
      });
      if (warehouseLocations.length > 0) {
        to_location_id = warehouseLocations[0].id;
      }
    }

    if (!to_location_id) {
      return Response.json({
        success: false,
        reason: 'missing_to_location',
        message: 'No destination location specified and no default found'
      }, { status: 400 });
    }

    // Create StockMovements for each ReceiptLine (with idempotency)
    let created = 0;
    let skipped = 0;

    for (const line of receiptLines) {
      // Check if movement already exists (idempotency)
      const existingMovements = await base44.asServiceRole.entities.StockMovement.filter({
        stop_id: stop.id,
        source_receipt_line_id: line.id
      });

      if (existingMovements.length > 0) {
        skipped++;
        continue;
      }

      // Create movement
      await base44.asServiceRole.entities.StockMovement.create({
        source: 'receipt_clear',
        source_receipt_id: receipt.id,
        source_receipt_line_id: line.id,
        run_id: stop.run_id,
        stop_id: stop.id,
        project_id: line.project_id || receipt.project_id || null,
        purchase_order_id: line.purchase_order_id || receipt.purchase_order_id || null,
        catalog_item_id: line.catalog_item_id || null,
        description: line.description || null,
        quantity: line.qty_received,
        from_location_id: from_location_id,
        to_location_id: to_location_id,
        performed_at: confirmation.completed_at || new Date().toISOString(),
        performed_by_user_id: confirmation.completed_by_user_id || null,
        performed_by_user_name: confirmation.completed_by_name || 'system',
        write_source: 'sync',
        notes: `Auto-created from clear_loading_bay stop completion`
      });

      created++;
    }

    console.log(`[applyInventoryMovements] Created ${created} movements, skipped ${skipped} for stop ${stop.id}`);

    return Response.json({
      success: true,
      created,
      skipped
    });

  } catch (error) {
    console.error('[applyInventoryMovements] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});