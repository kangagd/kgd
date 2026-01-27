import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { checkInventoryTrackability } from './shared/inventoryTrackingGuardrails.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admin, manager, and technicians
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isTechnician = user.is_field_technician === true;
    
    if (!isAdmin && !isManager && !isTechnician) {
      return Response.json({ error: 'Forbidden: Admin, manager, or technician access required' }, { status: 403 });
    }

    const { po_id, location_id, receive_date_time, items, mark_po_received, notes, reference_type, reference_id, destination_location_id, job_id } = await req.json();
    
    console.log('[receivePoItems] Parameters received:', { po_id, job_id, reference_type, has_items: items?.length });
    
    // Support both location_id and destination_location_id for backwards compatibility
    const finalLocationId = location_id || destination_location_id;

    if (!po_id || !finalLocationId || !items || items.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate and default performed_at timestamp
    let performedAt = receive_date_time;
    try {
      if (performedAt) {
        new Date(performedAt).toISOString(); // Validate ISO format
      } else {
        performedAt = new Date().toISOString();
      }
    } catch {
      performedAt = new Date().toISOString();
    }

    // Fetch PO and its line items
    const po = await base44.asServiceRole.entities.PurchaseOrder.get(po_id);
    if (!po) {
      return Response.json({ error: 'PO not found' }, { status: 404 });
    }

    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po_id
    });

    // Fetch destination location to determine canonical status
    const destLocation = await base44.asServiceRole.entities.InventoryLocation.get(finalLocationId);
    if (!destLocation) {
      return Response.json({ error: 'Destination location not found' }, { status: 404 });
    }

    // Process each item being received
    let allItemsFullyReceived = true;
    let totalItemsReceived = 0;
    const skippedLines = [];

    for (const receiveItem of items) {
      const poLine = poLines.find(l => l.id === receiveItem.po_line_id);
      if (!poLine) continue;

      const qtyReceived = receiveItem.qty_received || 0;
      if (qtyReceived <= 0) continue;

      // GUARDRAIL: Check if line is inventory-tracked (allow custom items from logistics jobs)
      const isLogisticsJob = job_id && reference_type === 'purchase_order';
      const trackCheck = checkInventoryTrackability(poLine, isLogisticsJob);

      console.log('[receivePoItems] Item check:', { 
        po_line_id: receiveItem.po_line_id,
        has_price_list_item_id: !!poLine.price_list_item_id,
        isLogisticsJob,
        isInventoryTracked: trackCheck.isInventoryTracked,
        reason: trackCheck.reason
      });

      if (!trackCheck.isInventoryTracked) {
        skippedLines.push({
          po_line_id: receiveItem.po_line_id,
          item_name: poLine.item_name || 'Unknown',
          warning_badge: 'Not inventory-tracked',
          reason: trackCheck.reason
        });
        continue;
      }

      // TECHNICIAN GUARDRAIL: Enforce warehouse/vehicle-only destinations
      if (isTechnician) {
        // Resolve technician's assigned vehicle
        const techVehicles = await base44.asServiceRole.entities.Vehicle.filter({
          assigned_user_id: user.id,
          is_active: { $ne: false }
        });

        if (techVehicles.length === 0) {
          return Response.json({ 
            error: 'Technicians must have an assigned vehicle to receive stock' 
          }, { status: 403 });
        }

        const techVehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
          type: 'vehicle',
          vehicle_id: techVehicles[0].id,
          is_active: { $ne: false }
        });

        const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
          type: 'warehouse',
          is_active: { $ne: false }
        });

        const allowedLocations = [
          ...techVehicleLocs.map(l => l.id),
          ...(warehouses.length > 0 ? [warehouses[0].id] : [])
        ];

        if (!allowedLocations.includes(finalLocationId)) {
          return Response.json({ 
            error: 'Technicians can only receive to their vehicle or the main warehouse' 
          }, { status: 403 });
        }
      }

      // Update PO line qty_received
      const newQtyReceived = (poLine.qty_received || 0) + qtyReceived;
      const qtyOrdered = poLine.qty_ordered || 0;

      await base44.asServiceRole.entities.PurchaseOrderLine.update(poLine.id, {
        qty_received: newQtyReceived
      });

      // Create StockMovement record (standardized schema with optional job reference override)
      const mvRefType = reference_type || 'purchase_order';
      const mvRefId = reference_id || po_id;

      const smData = {
        item_name: poLine.item_name || 'Unknown Item',
        quantity: qtyReceived,
        to_location_id: finalLocationId,
        to_location_name: destLocation.name,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: performedAt,
        source: 'po_receipt',
        reference_type: mvRefType,
        reference_id: mvRefId,
        notes: notes ? `PO ${po.po_reference || po.id}: ${notes}` : `Received from PO ${po.po_reference || po.id}`
      };

      // Only add price_list_item_id if it exists
      if (poLine.price_list_item_id) {
        smData.price_list_item_id = poLine.price_list_item_id;
      }

      await base44.asServiceRole.entities.StockMovement.create(smData);

      // Upsert InventoryQuantity (add to on-hand) - only if price_list_item_id exists
      if (poLine.price_list_item_id) {
        const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: poLine.price_list_item_id,
          location_id: finalLocationId
        });

        const currentQty = existing[0]?.quantity || 0;
        const newQty = currentQty + qtyReceived;

        if (existing[0]) {
          await base44.asServiceRole.entities.InventoryQuantity.update(existing[0].id, {
            quantity: newQty
          });
        } else {
          await base44.asServiceRole.entities.InventoryQuantity.create({
            price_list_item_id: poLine.price_list_item_id,
            location_id: finalLocationId,
            quantity: newQty,
            item_name: poLine.item_name,
            location_name: destLocation.name
          });
        }
      }

      // Check if line is fully received
      if (newQtyReceived < qtyOrdered) {
        allItemsFullyReceived = false;
      }

      totalItemsReceived++;
    }

    // Update PO status to canonical values based on receiving state and destination location
    if (totalItemsReceived > 0) {
      let newStatus;

      // Check if all PO lines are fully received
      const allLinesFullyReceived = poLines.every(line => {
        const updated = items.find(i => i.po_line_id === line.id);
        const newQty = (line.qty_received || 0) + (updated?.qty_received || 0);
        return newQty >= (line.qty_ordered || 0);
      });

      if (allLinesFullyReceived) {
        // All items fully received - determine final status by location type
        if (destLocation.type === 'vehicle') {
          newStatus = 'in_vehicle';
        } else if (destLocation.type === 'warehouse') {
          newStatus = 'in_storage';
        } else {
          newStatus = 'in_storage'; // Default to warehouse storage
        }
      } else {
        // Partially received - use in_loading_bay for partial receives
        newStatus = 'in_loading_bay';
      }

      await base44.asServiceRole.entities.PurchaseOrder.update(po_id, {
        status: newStatus
      });
    }

    // Update logistics job stock_transfer_status if job_id provided
    if (job_id && totalItemsReceived > 0) {
      try {
        await base44.asServiceRole.entities.Job.update(job_id, {
          stock_transfer_status: 'completed'
        });
      } catch (error) {
        console.warn('Failed to update job stock_transfer_status:', error);
        // Non-blocking - continue with success response
      }
    }

    // Determine success status
    const hasFailed = totalItemsReceived === 0 && skippedLines.length > 0;
    const hasWarnings = skippedLines.length > 0;

    return Response.json({
      success: !hasFailed,
      items_received: totalItemsReceived,
      skipped_items: skippedLines.length,
      skipped_lines: skippedLines,
      message: hasFailed 
        ? `Failed to receive any items` 
        : `Received ${totalItemsReceived} item(s)${hasWarnings ? ` (${skippedLines.length} skipped)` : ''}`
    });
  } catch (error) {
    console.error('Receive PO items error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});