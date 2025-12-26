import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

// Canonical PO status values
const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const PO_DELIVERY_METHOD = {
  DELIVERY: "delivery",
  PICKUP: "pickup",
};

// Normalize legacy status values to canonical ones
function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  switch (status.toLowerCase()) {
    case "draft": return PO_STATUS.DRAFT;
    case "sent": return PO_STATUS.SENT;
    case "on_order":
    case "on order": return PO_STATUS.ON_ORDER;
    case "partially_received":
    case "in_transit":
    case "in transit": return PO_STATUS.IN_TRANSIT;
    case "received":
    case "delivered":
    case "delivered - loading bay":
    case "delivered_loading_bay":
    case "delivered to delivery bay":
    case "delivered to loading bay":
    case "in_loading_bay":
    case "in loading bay": return PO_STATUS.IN_LOADING_BAY;
    case "in_storage":
    case "in storage": return PO_STATUS.IN_STORAGE;
    case "in_vehicle":
    case "in vehicle": return PO_STATUS.IN_VEHICLE;
    case "installed": return PO_STATUS.INSTALLED;
    case "cancelled": return PO_STATUS.CANCELLED;
    default: return status;
  }
}

// Helper: Build line item data
async function buildLineItemData(base44, purchaseOrderId, item) {
  const sourceType = item.source_type || "custom";
  const sourceId = item.source_id || item.price_list_item_id || item.part_id || null;
  const partId = item.part_id || null;
  
  let itemName = item.name || item.item_name || item.description || '';
  let unitPrice = item.unit_price || item.price || item.unit_cost_ex_tax || 0;
  let unit = item.unit || null;
  
  // Auto-populate from source if name/price not provided
  if (sourceId && (!itemName || !unitPrice)) {
    try {
      if (sourceType === "price_list") {
        const priceListItem = await base44.asServiceRole.entities.PriceListItem.get(sourceId);
        if (priceListItem) {
          itemName = itemName || priceListItem.item;
          unitPrice = unitPrice || priceListItem.unit_cost || priceListItem.price || 0;
        }
      } else if (sourceType === "project_part") {
        const part = await base44.asServiceRole.entities.Part.get(sourceId);
        if (part) {
          itemName = itemName || part.category;
        }
      }
    } catch (err) {
      console.error(`Failed to auto-populate from ${sourceType}:`, err);
    }
  }
  
  return {
    purchase_order_id: purchaseOrderId,
    source_type: sourceType,
    source_id: sourceId,
    part_id: partId,
    price_list_item_id: sourceType === "price_list" ? sourceId : (item.price_list_item_id || null),
    item_name: itemName,
    description: item.description || itemName || '',
    qty_ordered: item.quantity || item.qty || item.qty_ordered || 0,
    unit_cost_ex_tax: unitPrice,
    unit: unit,
    tax_rate_percent: item.tax_rate_percent || 0,
    total_line_ex_tax: (item.quantity || item.qty || 0) * unitPrice,
    notes: item.notes || null
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action } = payload;

    // ========================================
    // STRICT PAYLOAD VALIDATION
    // ========================================
    
    // Reject data:{...} shape for new actions (only allow for legacy compatibility)
    const legacyActions = ['create', 'update', 'getOrCreateProjectSupplierDraft'];
    if (payload.data && !legacyActions.includes(action)) {
      console.error('[PO] Rejected payload', { 
        action, 
        id: payload.id, 
        hasData: !!payload.data, 
        keys: Object.keys(payload) 
      });
      return Response.json({ 
        error: 'Forbidden payload shape: do not send data. Send top-level fields for this action.' 
      }, { status: 400 });
    }

    // Reject forbidden fields anywhere in payload
    const forbiddenGlobalFields = ['po_number', 'order_reference', 'reference'];
    const foundForbidden = forbiddenGlobalFields.filter(f => payload[f] !== undefined);
    if (foundForbidden.length > 0) {
      console.error('[PO] Rejected payload', { 
        action, 
        id: payload.id, 
        hasData: !!payload.data, 
        keys: Object.keys(payload),
        forbiddenFields: foundForbidden
      });
      return Response.json({ 
        error: `Forbidden fields: ${foundForbidden.join(', ')}. These are system-generated and cannot be set directly.` 
      }, { status: 400 });
    }

    // ========================================
    // ACTION: createDraft
    // ========================================
    if (action === 'createDraft') {
      const { supplier_id, project_id, delivery_method, delivery_location, notes, expected_date, attachments } = payload;

      // Validate required fields
      if (!supplier_id) {
        return Response.json({ error: 'supplier_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'po_number', 'order_reference', 'reference', 'sent_at', 'arrived_at'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [createDraft] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use createDraft for identity fields only.` 
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

      // Generate reference
      const canonicalRef = `PO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const poData = {
        supplier_id,
        supplier_name,
        project_id: project_id || null,
        status: PO_STATUS.DRAFT,
        delivery_method: delivery_method || PO_DELIVERY_METHOD.DELIVERY,
        delivery_location: delivery_location || null,
        notes: notes || null,
        po_reference: canonicalRef,
        name: null,
        created_by: user.email,
        order_date: new Date().toISOString().split('T')[0],
        expected_date: expected_date || null,
        attachments: attachments || [],
      };

      const po = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
      
      console.log('[createDraft] Created PO:', { id: po.id, po_reference: po.po_reference });

      if (po.project_id) {
        await updateProjectActivity(base44, po.project_id, 'PO Created');
      }

      // Return with empty line_items
      po.line_items = [];
      return Response.json({ success: true, purchaseOrder: po });
    }

    // ========================================
    // ACTION: updateIdentity
    // ========================================
    if (action === 'updateIdentity') {
      const { id, po_reference, name, supplier_id, notes, expected_date } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'po_number', 'order_reference', 'reference', 'project_id', 'delivery_method', 'sent_at', 'arrived_at'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [updateIdentity] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use updateIdentity only for: po_reference, name, supplier_id, notes, expected_date.` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      const updateData = {};

      // Update allowed fields
      if (po_reference !== undefined) {
        updateData.po_reference = po_reference?.trim() || null;
      }
      if (name !== undefined) {
        updateData.name = name?.trim() || null;
      }
      if (supplier_id !== undefined) {
        updateData.supplier_id = supplier_id;
        // Fetch and update supplier_name
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

      const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

      console.log('[updateIdentity] Updated PO:', { id, fields: Object.keys(updateData) });

      if (updatedPO.project_id) {
        await updateProjectActivity(base44, updatedPO.project_id, 'PO Updated');
      }

      return Response.json({ success: true, purchaseOrder: updatedPO });
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
      const forbiddenFields = ['po_reference', 'name', 'supplier_id', 'supplier_name', 'notes', 'expected_date', 'po_number', 'order_reference', 'reference'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [updateStatus] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use updateStatus only for status field.` 
        }, { status: 400 });
      }

      const validStatuses = Object.values(PO_STATUS);
      const normalizedStatus = normaliseLegacyPoStatus(status);
      
      if (!validStatuses.includes(normalizedStatus)) {
        return Response.json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      const updateData = { status: normalizedStatus };

      // Set timestamps based on status
      if (normalizedStatus === PO_STATUS.ON_ORDER && !po.sent_at) {
        updateData.sent_at = new Date().toISOString();
      } else if (normalizedStatus === PO_STATUS.IN_LOADING_BAY && !po.arrived_at) {
        updateData.arrived_at = new Date().toISOString();
      }

      const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

      console.log('[updateStatus] Updated PO status:', { 
        id, 
        old_status: po.status, 
        new_status: normalizedStatus 
      });

      if (updatedPO.project_id) {
        const activityType = normalizedStatus === PO_STATUS.IN_LOADING_BAY ? 'PO Delivered' :
                           normalizedStatus === PO_STATUS.IN_STORAGE ? 'PO in Storage' :
                           normalizedStatus === PO_STATUS.IN_VEHICLE ? 'PO in Vehicle' :
                           'PO Status Updated';
        await updateProjectActivity(base44, updatedPO.project_id, activityType);
      }

      return Response.json({ success: true, purchaseOrder: updatedPO });
    }

    // ========================================
    // ACTION: manageLineItems
    // ========================================
    if (action === 'manageLineItems') {
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
        console.error('❌ [manageLineItems] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use manageLineItems only for line_items array.` 
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
        const lineData = await buildLineItemData(base44, id, item);
        await base44.asServiceRole.entities.PurchaseOrderLine.create(lineData);
      }

      console.log('[manageLineItems] Updated line items for PO:', { 
        id, 
        count: line_items.length 
      });

      // Reload PO with line items
      const finalPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      const finalLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      
      finalPO.line_items = finalLines.map(line => ({
        id: line.id,
        source_type: line.source_type || "custom",
        source_id: line.source_id || null,
        part_id: line.part_id || null,
        name: line.item_name || line.description || '',
        quantity: line.qty_ordered || 0,
        unit_price: line.unit_cost_ex_tax || 0,
        unit: line.unit || null,
        notes: line.notes || null,
        price_list_item_id: line.price_list_item_id
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

      // Admins can delete any PO, non-admins can only delete drafts
      const isAdmin = user.role === 'admin';
      if (!isAdmin && po.status !== PO_STATUS.DRAFT) {
        return Response.json({ 
          error: 'Only Draft purchase orders can be deleted' 
        }, { status: 400 });
      }

      // 🚫 DISABLED: Delete associated parts
      // Parts are now managed independently
      console.warn('⚠️ [DELETE] Not deleting linked parts - they must be managed independently:', {
        po_id: id,
        po_reference: po.po_reference
      });

      // Delete line items
      const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      for (const line of lines) {
        await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
      }

      // Delete the PO
      await base44.asServiceRole.entities.PurchaseOrder.delete(id);

      console.log('[delete] Deleted PO:', { id });

      return Response.json({ success: true });
    }

    // ========================================
    // LEGACY COMPATIBILITY ACTIONS
    // ========================================
    
    // Map old 'create' to 'createDraft' + 'manageLineItems'
    if (action === 'create') {
      const { supplier_id, project_id, delivery_method, delivery_location, notes, expected_date, attachments, line_items } = payload;

      // Create draft PO first
      const draftResponse = await fetch(req.url, {
        method: 'POST',
        headers: { ...Object.fromEntries(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createDraft',
          supplier_id,
          project_id,
          delivery_method,
          delivery_location,
          notes,
          expected_date,
          attachments
        })
      });

      const draftResult = await draftResponse.json();
      if (!draftResult.success) {
        return Response.json(draftResult, { status: draftResponse.status });
      }

      const po = draftResult.purchaseOrder;

      // Add line items if provided
      if (line_items && line_items.length > 0) {
        const linesResponse = await fetch(req.url, {
          method: 'POST',
          headers: { ...Object.fromEntries(req.headers), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manageLineItems',
            id: po.id,
            line_items
          })
        });

        const linesResult = await linesResponse.json();
        if (!linesResult.success) {
          return Response.json(linesResult, { status: linesResponse.status });
        }

        return Response.json({ success: true, purchaseOrder: linesResult.purchaseOrder });
      }

      return Response.json({ success: true, purchaseOrder: po });
    }

    // Map old 'update' to appropriate new actions
    if (action === 'update') {
      const { id, supplier_id, notes, expected_date, name, po_reference, line_items } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      if (!po) {
        return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      // Update identity fields if any provided
      const identityFields = { po_reference, name, supplier_id, notes, expected_date };
      const hasIdentityUpdates = Object.values(identityFields).some(v => v !== undefined);

      if (hasIdentityUpdates) {
        const updateIdentityPayload = { action: 'updateIdentity', id };
        if (po_reference !== undefined) updateIdentityPayload.po_reference = po_reference;
        if (name !== undefined) updateIdentityPayload.name = name;
        if (supplier_id !== undefined) updateIdentityPayload.supplier_id = supplier_id;
        if (notes !== undefined) updateIdentityPayload.notes = notes;
        if (expected_date !== undefined) updateIdentityPayload.expected_date = expected_date;

        const identityResponse = await fetch(req.url, {
          method: 'POST',
          headers: { ...Object.fromEntries(req.headers), 'Content-Type': 'application/json' },
          body: JSON.stringify(updateIdentityPayload)
        });

        const identityResult = await identityResponse.json();
        if (!identityResult.success) {
          return Response.json(identityResult, { status: identityResponse.status });
        }
      }

      // Update line items if provided
      if (line_items && Array.isArray(line_items)) {
        const linesResponse = await fetch(req.url, {
          method: 'POST',
          headers: { ...Object.fromEntries(req.headers), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manageLineItems',
            id,
            line_items
          })
        });

        const linesResult = await linesResponse.json();
        if (!linesResult.success) {
          return Response.json(linesResult, { status: linesResponse.status });
        }

        return Response.json({ success: true, purchaseOrder: linesResult.purchaseOrder });
      }

      // Reload final PO
      const finalPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
      const finalLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
        purchase_order_id: id 
      });
      
      finalPO.line_items = finalLines.map(line => ({
        id: line.id,
        source_type: line.source_type || "custom",
        source_id: line.source_id || null,
        part_id: line.part_id || null,
        name: line.item_name || line.description || '',
        quantity: line.qty_ordered || 0,
        unit_price: line.unit_cost_ex_tax || 0,
        unit: line.unit || null,
        notes: line.notes || null,
        price_list_item_id: line.price_list_item_id
      }));

      return Response.json({ success: true, purchaseOrder: finalPO });
    }

    // ========================================
    // ACTION: getOrCreateProjectSupplierDraft (for backward compat)
    // ========================================
    if (action === 'getOrCreateProjectSupplierDraft') {
      const { project_id, supplier_id } = payload;

      if (!project_id || !supplier_id) {
        return Response.json({ 
          error: 'project_id and supplier_id are required' 
        }, { status: 400 });
      }

      // Find existing draft
      const existingPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({
        project_id,
        supplier_id,
        status: PO_STATUS.DRAFT
      });

      if (existingPOs.length > 0) {
        const existingPO = existingPOs[0];
        
        // Load line items
        const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
          purchase_order_id: existingPO.id 
        });
        
        existingPO.line_items = lines.map(line => ({
          id: line.id,
          source_type: line.source_type || "custom",
          source_id: line.source_id || null,
          part_id: line.part_id || null,
          name: line.item_name || line.description || '',
          quantity: line.qty_ordered || 0,
          unit_price: line.unit_cost_ex_tax || 0,
          unit: line.unit || null,
          notes: line.notes || null,
          price_list_item_id: line.price_list_item_id
        }));

        return Response.json({
          success: true,
          purchaseOrder: existingPO,
          reused: true
        });
      }

      // Create new draft using createDraft action
      const createResponse = await fetch(req.url, {
        method: 'POST',
        headers: { ...Object.fromEntries(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createDraft',
          supplier_id,
          project_id,
          delivery_method: payload.delivery_method,
          delivery_location: payload.delivery_location,
          notes: payload.notes,
          expected_date: payload.expected_date,
          attachments: payload.attachments
        })
      });

      const createResult = await createResponse.json();
      if (!createResult.success) {
        return Response.json(createResult, { status: createResponse.status });
      }

      return Response.json({
        success: true,
        purchaseOrder: createResult.purchaseOrder,
        reused: false
      });
    }

    return Response.json({ error: 'Invalid action. Supported: createDraft, updateIdentity, updateStatus, manageLineItems, delete' }, { status: 400 });

  } catch (error) {
    console.error('[managePurchaseOrder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});