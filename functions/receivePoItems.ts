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

    const { po_id, location_id, receive_date_time, items, mark_po_received, notes, reference_type, reference_id, destination_location_id } = await req.json();
    
    // Support both location_id and destination_location_id for backwards compatibility
    const finalLocationId = location_id || destination_location_id;

    if (!po_id || !finalLocationId || !items || items.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
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

      // GUARDRAIL: Check if line is inventory-tracked
      const trackCheck = checkInventoryTrackability(poLine);
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

      // Create StockMovement record (standardized schema)
      await base44.asServiceRole.entities.StockMovement.create({
        price_list_item_id: poLine.price_list_item_id,
        item_name: poLine.item_name || 'Unknown Item',
        quantity: qtyReceived,
        to_location_id: location_id,
        to_location_name: destLocation.name,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: receive_date_time,
        source: 'po_receipt',
        reference_type: 'purchase_order',
        reference_id: po_id,
        notes: notes ? `PO ${po.po_reference || po.id}: ${notes}` : `Received from PO ${po.po_reference || po.id}`
      });

      // Upsert InventoryQuantity (add to on-hand)
      const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id: poLine.price_list_item_id,
        location_id: location_id
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
          location_id: location_id,
          quantity: newQty,
          item_name: poLine.item_name,
          location_name: destLocation.name
        });
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