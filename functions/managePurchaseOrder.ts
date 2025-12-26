import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Valid V2 actions only
const VALID_ACTIONS = ['createDraft', 'updateIdentity', 'updateStatus', 'setLineItems', 'delete'];

// Valid PO statuses
const VALID_STATUSES = ['draft', 'sent', 'cancelled'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action } = payload;

    console.log(`[managePurchaseOrderV2] action=${action} po=${payload.id || 'new'} user=${user.email}`);

    // Reject legacy actions with 410 Gone
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({
        success: false,
        error: 'Legacy action removed. Use V2 actions: createDraft, updateIdentity, updateStatus, setLineItems, delete'
      }, { status: 410 });
    }

    // ========================================
    // ACTION: createDraft
    // ========================================
    if (action === 'createDraft') {
      const { 
        supplier_id, 
        project_id, 
        delivery_method, 
        delivery_location, 
        notes, 
        expected_date, 
        attachments 
      } = payload;

      if (!supplier_id) {
        return Response.json({ error: 'supplier_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'po_reference', 'name', 'po_number', 'order_reference', 'reference', 'sent_at', 'arrived_at'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [createDraft] Forbidden fields:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}` 
        }, { status: 400 });
      }

      // Fetch supplier name
      let supplier_name = null;
      try {
        const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
        supplier_name = supplier?.name || null;
      } catch (err) {
        console.error('Failed to fetch supplier:', err);
      }

      // Generate po_reference
      const po_reference = `PO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const order_date = new Date().toISOString().split('T')[0];

      const poData = {
        supplier_id,
        supplier_name,
        project_id: project_id || null,
        status: 'draft',
        delivery_method: delivery_method || 'delivery',
        delivery_location: delivery_location || null,
        notes: notes || null,
        po_reference,
        name: null,
        expected_date: expected_date || null,
        attachments: attachments || [],
        order_date,
        created_by: user.email,
      };

      const po = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
      po.line_items = [];

      return Response.json({ success: true, purchaseOrder: po });
    }

    // ========================================
    // ACTION: updateIdentity
    // ========================================
    if (action === 'updateIdentity') {
      const { id, po_reference, name, supplier_id, notes, expected_date, attachments } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'project_id', 'delivery_method', 'delivery_location', 'sent_at', 'arrived_at', 'po_number', 'order_reference', 'reference'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [updateIdentity] Forbidden fields:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      const updateData = {};

      if (po_reference !== undefined) {
        updateData.po_reference = po_reference?.trim() || null;
      }
      if (name !== undefined) {
        updateData.name = name?.trim() || null;
      }
      if (supplier_id !== undefined) {
        updateData.supplier_id = supplier_id;
        if (supplier_id) {
          try {
            const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
            updateData.supplier_name = supplier?.name || null;
          } catch (err) {
            console.error('Failed to fetch supplier:', err);
          }
        } else {
          updateData.supplier_name = null;
        }
      }
      if (notes !== undefined) {
        updateData.notes = notes || null;
      }
      if (expected_date !== undefined) {
        updateData.expected_date = expected_date || null;
      }
      if (attachments !== undefined) {
        updateData.attachments = attachments || [];
      }

      await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

      const freshPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      return Response.json({ success: true, purchaseOrder: freshPO });
    }

    // ========================================
    // ACTION: updateStatus
    // ========================================
    if (action === 'updateStatus') {
      const { id, status } = payload;

      if (!id || !status) {
        return Response.json({ error: 'id and status are required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['po_reference', 'name', 'supplier_id', 'notes', 'expected_date', 'attachments', 'sent_at', 'arrived_at'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [updateStatus] Forbidden fields:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}` 
        }, { status: 400 });
      }

      if (!VALID_STATUSES.includes(status)) {
        return Response.json({ 
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      console.log('[PO updateStatus] pure status update', { id, status });

      await base44.asServiceRole.entities.PurchaseOrder.update(id, { status });

      const freshPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      return Response.json({ success: true, purchaseOrder: freshPO });
    }

    // ========================================
    // ACTION: setLineItems
    // ========================================
    if (action === 'setLineItems') {
      const { id, line_items } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      if (!line_items || !Array.isArray(line_items)) {
        return Response.json({ error: 'line_items array is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'po_reference', 'name', 'supplier_id', 'notes', 'expected_date'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [setLineItems] Forbidden fields:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      // Delete existing lines
      const existingLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      for (const line of existingLines) {
        await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
      }

      // Create new lines
      for (const item of line_items) {
        const lineData = {
          purchase_order_id: id,
          item_name: item.item_name || item.name || '',
          description: item.description || item.item_name || item.name || '',
          qty_ordered: item.qty_ordered || item.quantity || item.qty || 0,
          unit_cost_ex_tax: item.unit_cost_ex_tax || item.unit_price || item.price || 0,
          unit: item.unit || null,
          tax_rate_percent: item.tax_rate_percent || 0,
          total_line_ex_tax: (item.qty_ordered || item.quantity || item.qty || 0) * (item.unit_cost_ex_tax || item.unit_price || item.price || 0),
          source_type: item.source_type || null,
          source_id: item.source_id || null,
          part_id: item.part_id || null,
          notes: item.notes || null,
        };
        await base44.asServiceRole.entities.PurchaseOrderLine.create(lineData);
      }

      // Reload with line items
      const finalPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      const finalLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      
      finalPO.line_items = finalLines.map(line => ({
        id: line.id,
        item_name: line.item_name,
        description: line.description,
        qty_ordered: line.qty_ordered,
        unit_cost_ex_tax: line.unit_cost_ex_tax,
        unit: line.unit,
        tax_rate_percent: line.tax_rate_percent,
        total_line_ex_tax: line.total_line_ex_tax,
        source_type: line.source_type,
        source_id: line.source_id,
        part_id: line.part_id,
        notes: line.notes,
      }));

      return Response.json({ success: true, purchaseOrder: finalPO });
    }

    // ========================================
    // ACTION: delete
    // ========================================
    if (action === 'delete') {
      const { id } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      // Delete line items
      const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      for (const line of lines) {
        await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
      }

      // Delete the PO
      await base44.asServiceRole.entities.PurchaseOrder.delete(id);

      return Response.json({ success: true });
    }

    // Should never reach here due to VALID_ACTIONS check
    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[managePurchaseOrderV2] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});