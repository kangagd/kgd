import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'manager', 'technician'].includes(user.extended_role || user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { po_id, location_id, receive_date_time, items, notes } = await req.json();

    if (!po_id || !location_id || !items || items.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch location details
    const location = await base44.asServiceRole.entities.InventoryLocation.get(location_id);
    if (!location) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    // Fetch PO lines
    const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      purchase_order_id: po_id
    });

    let totalReceived = 0;

    for (const receiveItem of items) {
      const poLine = poLines.find(l => l.id === receiveItem.po_line_id);
      if (!poLine) continue;

      const qtyReceived = receiveItem.qty_received || 0;
      if (qtyReceived <= 0) continue;

      // Update PO line qty_received
      await base44.asServiceRole.entities.PurchaseOrderLine.update(poLine.id, {
        qty_received: (poLine.qty_received || 0) + qtyReceived
      });

      // Update linked Part if exists
      const parts = await base44.asServiceRole.entities.Part.filter({
        po_line_id: poLine.id
      });

      if (parts.length > 0) {
        const part = parts[0];
        const newStatus = location.type === 'vehicle' ? 'in_vehicle' : 'in_storage';
        
        await base44.asServiceRole.entities.Part.update(part.id, {
          status: newStatus,
          location: location.type === 'vehicle' ? 'vehicle' : 'warehouse_storage'
        });
      }

      totalReceived++;
    }

    return Response.json({
      success: totalReceived > 0,
      items_received: totalReceived,
      skipped_items: 0,
      skipped_lines: [],
      message: `Received ${totalReceived} part(s)`
    });
  } catch (error) {
    console.error('Receive part lines error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});