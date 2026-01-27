import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      purchase_order_id,
      job_id = null,
      destination_location_id = null,
      received_at = null,
      notes = null,
      lines = []
    } = payload;

    if (!purchase_order_id) {
      return Response.json({ 
        success: false, 
        error: 'Missing purchase_order_id' 
      }, { status: 400 });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No lines provided for receipt' 
      }, { status: 400 });
    }

    // Load PO and lines
    const po = await base44.asServiceRole.entities.PurchaseOrder.get(purchase_order_id);
    if (!po) {
      return Response.json({ 
        success: false, 
        error: 'Purchase Order not found' 
      }, { status: 404 });
    }

    const allPoLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
      purchase_order_id 
    });

    const receivedAt = received_at || new Date().toISOString();
    const skippedLines = [];
    const warnings = [];
    let inventoryReceipts = 0;
    let nonInventoryReceipts = 0;
    let itemsReceived = 0;

    // Fetch destination location if provided (for inventory lines)
    let destinationLocation = null;
    if (destination_location_id) {
      destinationLocation = await base44.asServiceRole.entities.InventoryLocation.get(destination_location_id);
      
      // Technician permission check
      if (user.is_field_technician && user.role !== 'admin') {
        const isMainWarehouse = destinationLocation.name?.toLowerCase().includes('main') && 
                                destinationLocation.type === 'warehouse';
        const isOwnVehicle = destinationLocation.type === 'vehicle' && 
                             destinationLocation.vehicle_id && 
                             user.assigned_vehicle_id === destinationLocation.vehicle_id;
        
        if (!isMainWarehouse && !isOwnVehicle) {
          return Response.json({
            success: false,
            error: 'Technicians can only receive to main warehouse or their assigned vehicle'
          }, { status: 403 });
        }
      }
    }

    // Process each line
    for (const lineReq of lines) {
      const { po_line_id, receive_qty } = lineReq;

      if (!receive_qty || receive_qty <= 0) {
        skippedLines.push({ po_line_id, reason: 'Receive quantity must be > 0' });
        continue;
      }

      const poLine = allPoLines.find(l => l.id === po_line_id);
      if (!poLine) {
        skippedLines.push({ po_line_id, reason: 'PO line not found' });
        continue;
      }

      const qtyOrdered = poLine.qty_ordered || 0;
      const qtyReceived = poLine.qty_received || 0;
      const remaining = qtyOrdered - qtyReceived;

      if (receive_qty > remaining) {
        skippedLines.push({ 
          po_line_id, 
          reason: `Cannot receive ${receive_qty} (only ${remaining} remaining)` 
        });
        continue;
      }

      // Update PO line qty_received (ALWAYS, for all line types)
      const newQtyReceived = qtyReceived + receive_qty;
      await base44.asServiceRole.entities.PurchaseOrderLine.update(po_line_id, {
        qty_received: newQtyReceived
      });

      // Classify line type and process accordingly
      if (poLine.price_list_item_id) {
        // Check if PriceListItem is inventory-tracked
        let priceListItem = null;
        try {
          priceListItem = await base44.asServiceRole.entities.PriceListItem.get(poLine.price_list_item_id);
        } catch (err) {
          warnings.push(`PriceListItem ${poLine.price_list_item_id} not found for line ${po_line_id}`);
          nonInventoryReceipts++;
          itemsReceived++;
          continue;
        }

        // Check if tracked (assume track_inventory field, or default true if not present)
        const isTracked = priceListItem.track_inventory !== false;

        if (!isTracked) {
          // Non-tracked SKU: treat as NON_STOCK
          warnings.push(`Item "${poLine.item_name}" is not inventory-tracked (qty_received updated only)`);
          nonInventoryReceipts++;
          itemsReceived++;
          continue;
        }

        // STOCK_SKU: increase inventory
        if (!destination_location_id) {
          skippedLines.push({ 
            po_line_id, 
            reason: 'Inventory-tracked item requires destination location' 
          });
          continue;
        }

        // Upsert InventoryQuantity
        const existing = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: poLine.price_list_item_id,
          location_id: destination_location_id
        });

        if (existing.length > 0) {
          const current = existing[0];
          await base44.asServiceRole.entities.InventoryQuantity.update(current.id, {
            quantity: (current.quantity || 0) + receive_qty
          });
        } else {
          await base44.asServiceRole.entities.InventoryQuantity.create({
            price_list_item_id: poLine.price_list_item_id,
            location_id: destination_location_id,
            quantity: receive_qty
          });
        }

        // Create StockMovement
        const movementNotes = notes 
          ? `PO Receipt: ${po.po_reference || po.id} - ${notes}` 
          : `PO Receipt: ${po.po_reference || po.id}`;

        await base44.asServiceRole.entities.StockMovement.create({
          price_list_item_id: poLine.price_list_item_id,
          quantity: receive_qty,
          from_location_id: null,
          to_location_id: destination_location_id,
          movement_type: 'receipt',
          source: 'po_receipt',
          reference_type: 'purchase_order',
          reference_id: purchase_order_id,
          job_id: job_id,
          notes: movementNotes,
          moved_at: receivedAt
        });

        inventoryReceipts++;
        itemsReceived++;

      } else {
        // No price_list_item_id: PROJECT_PART or NON_STOCK
        // Check if there's a linked Part
        const linkedParts = await base44.asServiceRole.entities.Part.filter({
          po_line_id: po_line_id
        });

        if (linkedParts.length > 0) {
          // PROJECT_PART: update Part status/location
          const part = linkedParts[0];
          const updates = {
            qty_received: newQtyReceived
          };

          // Update Part location based on destination type
          if (destinationLocation) {
            if (destinationLocation.type === 'warehouse') {
              updates.status = 'in_storage';
              updates.location = 'warehouse_storage';
            } else if (destinationLocation.type === 'vehicle') {
              updates.status = 'in_vehicle';
              updates.location = 'vehicle';
              updates.vehicle_id = destinationLocation.vehicle_id || null;
            }
          } else {
            // No destination specified: mark as received but location TBD
            updates.status = 'in_transit';
          }

          await base44.asServiceRole.entities.Part.update(part.id, updates);
          nonInventoryReceipts++;
          itemsReceived++;
        } else {
          // NON_STOCK: qty_received already updated above
          nonInventoryReceipts++;
          itemsReceived++;
        }
      }
    }

    // Update PO status if fully or partially received
    const updatedPoLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
      purchase_order_id 
    });
    
    const allFullyReceived = updatedPoLines.every(line => 
      (line.qty_received || 0) >= (line.qty_ordered || 0)
    );
    
    const anyReceived = updatedPoLines.some(line => (line.qty_received || 0) > 0);
    
    let updatedPoStatus = po.status;
    if (allFullyReceived && destinationLocation) {
      updatedPoStatus = destinationLocation.type === 'vehicle' ? 'in_vehicle' : 'in_storage';
    } else if (anyReceived && !allFullyReceived) {
      updatedPoStatus = 'in_loading_bay';
    }

    if (updatedPoStatus !== po.status) {
      await base44.asServiceRole.entities.PurchaseOrder.update(purchase_order_id, {
        status: updatedPoStatus
      });
    }

    // Update linked job if provided
    if (job_id && itemsReceived > 0) {
      await base44.asServiceRole.entities.Job.update(job_id, {
        stock_transfer_status: 'completed'
      });
    }

    return Response.json({
      success: itemsReceived > 0,
      items_received: itemsReceived,
      inventory_receipts: inventoryReceipts,
      non_inventory_receipts: nonInventoryReceipts,
      skipped_lines: skippedLines,
      warnings: warnings,
      updated_po_status: updatedPoStatus !== po.status ? updatedPoStatus : null
    });

  } catch (error) {
    console.error('receivePoItemsMixed error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      items_received: 0,
      skipped_lines: []
    }, { status: 500 });
  }
});