import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Receive a PO line item
 * 
 * Does:
 * 1. Validate qty_received does not exceed qty_ordered
 * 2. Call recordStockMovement("po_receipt") to create InventoryQuantity
 * 3. Update POLine.qty_received
 * 4. Inbound is automatically reduced (derived from order - received)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      poLineId,
      quantityReceived,
      receiveToLocationId, // Where to place received stock
      notes = null
    } = await req.json();

    // Validation
    if (!poLineId || !quantityReceived || quantityReceived <= 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Fetch PO line
    const poLine = await base44.asServiceRole.entities.PurchaseOrderLine.get(poLineId);
    if (!poLine) {
      return Response.json({ error: 'PO line not found' }, { status: 404 });
    }

    const alreadyReceived = poLine.qty_received || 0;
    const newTotal = alreadyReceived + quantityReceived;

    // Validate doesn't exceed ordered
    if (newTotal > (poLine.qty_ordered || 0)) {
      return Response.json({ 
        error: `Cannot receive ${quantityReceived}. Already received: ${alreadyReceived}, Ordered: ${poLine.qty_ordered}` 
      }, { status: 400 });
    }

    // Get PO to find supplier reference
    const po = await base44.asServiceRole.entities.PurchaseOrder.get(poLine.purchase_order_id);
    if (!po) {
      return Response.json({ error: 'PO not found' }, { status: 404 });
    }

    // Get location if specified
    let receiveLocation = null;
    if (receiveToLocationId) {
      receiveLocation = await base44.asServiceRole.entities.InventoryLocation.get(receiveToLocationId);
      if (!receiveLocation) {
        return Response.json({ error: 'Receive location not found' }, { status: 404 });
      }
    } else {
      // Default to first active warehouse
      const allLocations = await base44.asServiceRole.entities.InventoryLocation.filter({});
      const warehouseLocs = allLocations.filter(loc => 
        (loc.is_active !== false) && 
        String(loc.type || '').toLowerCase() === 'warehouse'
      );
      
      if (warehouseLocs.length === 0) {
        return Response.json({ error: 'No active warehouse location configured' }, { status: 400 });
      }
      receiveLocation = warehouseLocs[0];
      receiveToLocationId = receiveLocation.id;
    }

    // Get SKU (PriceListItem)
    let priceListItemId = poLine.price_list_item_id || poLine.source_id;
    let item = null;

    if (priceListItemId) {
      item = await base44.asServiceRole.entities.PriceListItem.get(priceListItemId);
    }

    // Call canonical recordStockMovement to create InventoryQuantity
    // source = "po_receipt" indicates this came from a PO receipt
    const movementResponse = await base44.asServiceRole.functions.invoke('recordStockMovement', {
      priceListItemId: priceListItemId,
      fromLocationId: null, // PO receipt = external inbound
      toLocationId: receiveToLocationId,
      quantity: quantityReceived,
      movementType: 'po_receipt',
      notes: notes || `Received from PO ${po.po_reference}: ${poLine.item_name}`,
      jobId: po.linked_logistics_job_id || null
    });

    if (movementResponse.data.error) {
      throw new Error(movementResponse.data.error);
    }

    // Update PO line qty_received
    const updatedLine = await base44.asServiceRole.entities.PurchaseOrderLine.update(poLineId, {
      qty_received: newTotal
    });

    // Check if entire PO is received
    const allLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po.id
    });

    const totalOrdered = allLines.reduce((sum, line) => sum + (line.qty_ordered || 0), 0);
    const totalReceived = allLines.reduce((sum, line) => sum + ((line.qty_received || 0) + (line.id === poLineId ? quantityReceived : 0)), 0);

    // If fully received, update PO status to in_storage
    if (totalOrdered > 0 && totalReceived >= totalOrdered && po.status !== 'in_storage') {
      await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
        status: 'in_storage'
      });
    }

    return Response.json({
      success: true,
      message: `Received ${quantityReceived} of ${poLine.item_name} from PO ${po.po_reference}`,
      poLine: updatedLine,
      stockMoved: movementResponse.data,
      onHand: quantityReceived,
      outstanding: (poLine.qty_ordered || 0) - newTotal
    });

  } catch (error) {
    console.error('[receivePOLine] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});