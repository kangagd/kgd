import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { po_id, location_id, receive_date_time, items, mark_po_received, notes } = await req.json();

    if (!po_id || !location_id || !items || items.length === 0) {
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

    // Process each item being received
    let allItemsFullyReceived = true;
    let totalItemsReceived = 0;

    for (const receiveItem of items) {
      const poLine = poLines.find(l => l.id === receiveItem.po_line_id);
      if (!poLine) continue;

      const qtyReceived = receiveItem.qty_received || 0;
      if (qtyReceived <= 0) continue;

      // Update PO line qty_received
      const newQtyReceived = (poLine.qty_received || 0) + qtyReceived;
      const qtyOrdered = poLine.qty_ordered || 0;

      await base44.asServiceRole.entities.PurchaseOrderLine.update(poLine.id, {
        qty_received: newQtyReceived
      });

      // Create StockMovement record
      await base44.asServiceRole.entities.StockMovement.create({
        sku_id: poLine.price_list_item_id || null,
        item_name: poLine.item_name || 'Unknown Item',
        quantity: qtyReceived,
        to_location_id: location_id,
        to_location_name: (await base44.asServiceRole.entities.InventoryLocation.get(location_id))?.name || '',
        performed_by_user_id: user.id,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name,
        performed_at: receive_date_time,
        source: 'po_receipt',
        notes: notes ? `PO ${po.po_reference}: ${notes}` : `Received from PO ${po.po_reference}`
      });

      // Upsert InventoryQuantity (add to on-hand)
      if (poLine.price_list_item_id) {
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
            location_name: (await base44.asServiceRole.entities.InventoryLocation.get(location_id))?.name || ''
          });
        }
      }

      // Check if line is fully received
      if (newQtyReceived < qtyOrdered) {
        allItemsFullyReceived = false;
      }

      totalItemsReceived++;
    }

    // Update PO status if requested and all items fully received
    if (mark_po_received && allItemsFullyReceived) {
      await base44.asServiceRole.entities.PurchaseOrder.update(po_id, {
        status: 'received'
      });
    } else if (totalItemsReceived > 0) {
      // Mark as partially received if not all items received
      const allLinesReceived = poLines.every(line => {
        const updated = items.find(i => i.po_line_id === line.id);
        const newQty = (line.qty_received || 0) + (updated?.qty_received || 0);
        return newQty >= (line.qty_ordered || 0);
      });

      if (allLinesReceived) {
        await base44.asServiceRole.entities.PurchaseOrder.update(po_id, {
          status: 'received'
        });
      } else {
        // Update to partially_received if any line has some qty received
        await base44.asServiceRole.entities.PurchaseOrder.update(po_id, {
          status: 'partially_received'
        });
      }
    }

    return Response.json({
      success: true,
      items_received: totalItemsReceived,
      message: `Received ${totalItemsReceived} item(s)`
    });
  } catch (error) {
    console.error('Receive PO items error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});