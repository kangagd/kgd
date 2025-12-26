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
      const allowedFields = new Set(['action', 'supplier_id', 'project_id', 'delivery_method', 'delivery_location', 'notes', 'expected_date', 'attachments']);
      const payloadKeys = Object.keys(payload);
      const forbiddenFields = payloadKeys.filter(k => !allowedFields.has(k));
      
      if (forbiddenFields.length > 0) {
        console.warn('[managePurchaseOrderV2] Validation failed', {
          action: 'createDraft',
          poId: null,
          forbiddenFields
        });
        return Response.json({ 
          success: false,
          error: `Forbidden fields for createDraft: ${forbiddenFields.join(', ')}` 
        }, { status: 400 });
      }

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
        return Response.json({ success: false, error: 'supplier_id is required' }, { status: 400 });
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
      const allowedFields = new Set(['action', 'id', 'po_reference', 'name', 'supplier_id', 'notes', 'expected_date', 'attachments']);
      const payloadKeys = Object.keys(payload);
      const forbiddenFields = payloadKeys.filter(k => !allowedFields.has(k));
      
      if (forbiddenFields.length > 0) {
        console.warn('[managePurchaseOrderV2] Validation failed', {
          action: 'updateIdentity',
          poId: payload.id || null,
          forbiddenFields
        });
        return Response.json({ 
          success: false,
          error: `Forbidden fields for updateIdentity: ${forbiddenFields.join(', ')}` 
        }, { status: 400 });
      }

      const { id, po_reference, name, supplier_id, notes, expected_date, attachments } = payload;

      if (!id) {
        return Response.json({ success: false, error: 'id is required' }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ success: false, error: 'Purchase Order not found' }, { status: 404 });
      }

      const updateData = {};

      if (po_reference !== undefined) {
        const trimmed = po_reference?.trim() || '';
        if (trimmed === '') {
          return Response.json({ success: false, error: 'po_reference cannot be empty' }, { status: 400 });
        }
        if (trimmed.length > 50) {
          return Response.json({ success: false, error: 'po_reference max length is 50 characters' }, { status: 400 });
        }
        updateData.po_reference = trimmed;
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
      const allowedFields = new Set(['action', 'id', 'status']);
      const payloadKeys = Object.keys(payload);
      const forbiddenFields = payloadKeys.filter(k => !allowedFields.has(k));
      
      if (forbiddenFields.length > 0) {
        console.warn('[managePurchaseOrderV2] Validation failed', {
          action: 'updateStatus',
          poId: payload.id || null,
          forbiddenFields
        });
        return Response.json({ 
          success: false,
          error: `Forbidden fields for updateStatus: ${forbiddenFields.join(', ')}` 
        }, { status: 400 });
      }

      const { id, status } = payload;

      if (!id || !status) {
        return Response.json({ success: false, error: 'id and status are required' }, { status: 400 });
      }

      if (!VALID_STATUSES.includes(status)) {
        return Response.json({ 
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ success: false, error: 'Purchase Order not found' }, { status: 404 });
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
      const allowedFields = new Set(['action', 'id', 'line_items']);
      const payloadKeys = Object.keys(payload);
      const forbiddenFields = payloadKeys.filter(k => !allowedFields.has(k));
      
      if (forbiddenFields.length > 0) {
        console.warn('[managePurchaseOrderV2] Validation failed', {
          action: 'setLineItems',
          poId: payload.id || null,
          forbiddenFields
        });
        return Response.json({ 
          success: false,
          error: `Forbidden fields for setLineItems: ${forbiddenFields.join(', ')}` 
        }, { status: 400 });
      }

      const { id, line_items } = payload;

      if (!id) {
        return Response.json({ success: false, error: 'id is required' }, { status: 400 });
      }

      if (!line_items || !Array.isArray(line_items)) {
        return Response.json({ success: false, error: 'line_items array is required' }, { status: 400 });
      }

      // Validate each line item
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const hasName = item.item_name || item.description || item.name;
        if (!hasName) {
          return Response.json({ 
            success: false,
            error: `Line item at index ${i} must have at least one of: item_name, description, name` 
          }, { status: 400 });
        }
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ success: false, error: 'Purchase Order not found' }, { status: 404 });
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
        const qtyOrdered = Number(item.qty_ordered || item.quantity || item.qty || 1);
        const unitCostExTax = Number(item.unit_cost_ex_tax || item.unit_price || item.price || 0);
        
        const lineData = {
          purchase_order_id: id,
          item_name: item.item_name || item.name || '',
          description: item.description || item.item_name || item.name || '',
          qty_ordered: qtyOrdered,
          unit_cost_ex_tax: unitCostExTax,
          unit: item.unit || null,
          tax_rate_percent: item.tax_rate_percent || 0,
          total_line_ex_tax: qtyOrdered * unitCostExTax,
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
      const allowedFields = new Set(['action', 'id']);
      const payloadKeys = Object.keys(payload);
      const forbiddenFields = payloadKeys.filter(k => !allowedFields.has(k));
      
      if (forbiddenFields.length > 0) {
        console.warn('[managePurchaseOrderV2] Validation failed', {
          action: 'delete',
          poId: payload.id || null,
          forbiddenFields
        });
        return Response.json({ 
          success: false,
          error: `Forbidden fields for delete: ${forbiddenFields.join(', ')}` 
        }, { status: 400 });
      }

      const { id } = payload;

      if (!id) {
        return Response.json({ success: false, error: 'id is required' }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ success: false, error: 'Purchase Order not found' }, { status: 404 });
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
    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[managePurchaseOrderV2] Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});