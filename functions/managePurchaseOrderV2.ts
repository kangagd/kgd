import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * V2 Purchase Order Management Function
 * Command-based API with strict input validation
 * 
 * Supported Actions:
 * - createDraft: Create new draft PO with auto-generated po_ref
 * - updateHeader: Update header fields only
 * - setStatus: Update status only
 * - setLines: Replace all lines for a PO
 * - receiveIntoLoadingBay: Record receipt and create stock movements
 * - close: Close PO (with validation)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action } = payload;

    console.log('[managePurchaseOrderV2]', { action, user: user.email, payload });

    // Route to action handler
    switch (action) {
      case 'createDraft':
        return await handleCreateDraft(base44, user, payload);
      case 'updateHeader':
        return await handleUpdateHeader(base44, user, payload);
      case 'setStatus':
        return await handleSetStatus(base44, user, payload);
      case 'setLines':
        return await handleSetLines(base44, user, payload);
      case 'receiveIntoLoadingBay':
        return await handleReceiveIntoLoadingBay(base44, user, payload);
      case 'close':
        return await handleClose(base44, user, payload);
      default:
        return Response.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[managePurchaseOrderV2] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleCreateDraft(base44, user, payload) {
  const allowedKeys = ['action', 'type', 'project_id', 'supplier_id'];
  validatePayloadKeys(payload, allowedKeys, 'createDraft');

  const { type, project_id, supplier_id } = payload;

  // Validation
  if (!type || !['project', 'stock'].includes(type)) {
    throw new Error('type must be "project" or "stock"');
  }

  if (type === 'project' && !project_id) {
    throw new Error('project_id is required for project type POs');
  }

  if (!supplier_id) {
    throw new Error('supplier_id is required');
  }

  // Fetch supplier for caching name
  const supplier = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
  if (!supplier || supplier.length === 0) {
    throw new Error('Supplier not found');
  }

  // Generate sequential PO reference
  const po_ref = await generateNextPoRef(base44);

  // Create PO
  const poData = {
    po_ref,
    supplier_id,
    supplier_name: supplier[0].name,
    project_id: type === 'project' ? project_id : null,
    type,
    status: 'draft',
    delivery_method: 'delivery', // default
    order_date: new Date().toISOString().split('T')[0]
  };

  const po = await base44.asServiceRole.entities.PurchaseOrderV2.create(poData);

  console.log('[createDraft] Created PO:', po.id, po_ref);

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, po.id)
  });
}

async function handleUpdateHeader(base44, user, payload) {
  const allowedKeys = ['action', 'id', 'supplier_id', 'expected_date', 'notes', 'name', 'delivery_method', 'delivery_location'];
  validatePayloadKeys(payload, allowedKeys, 'updateHeader');

  const { id, supplier_id, expected_date, notes, name, delivery_method, delivery_location } = payload;

  if (!id) {
    throw new Error('id is required');
  }

  // Build update object with only provided fields
  const updates = {};
  if (supplier_id !== undefined) {
    // Fetch and cache supplier name
    const supplier = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
    if (!supplier || supplier.length === 0) {
      throw new Error('Supplier not found');
    }
    updates.supplier_id = supplier_id;
    updates.supplier_name = supplier[0].name;
  }
  if (expected_date !== undefined) updates.expected_date = expected_date;
  if (notes !== undefined) updates.notes = notes;
  if (name !== undefined) updates.name = name;
  if (delivery_method !== undefined) {
    if (!['delivery', 'pickup'].includes(delivery_method)) {
      throw new Error('delivery_method must be "delivery" or "pickup"');
    }
    updates.delivery_method = delivery_method;
  }
  if (delivery_location !== undefined) updates.delivery_location = delivery_location;

  await base44.asServiceRole.entities.PurchaseOrderV2.update(id, updates);

  console.log('[updateHeader] Updated PO:', id, Object.keys(updates));

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, id)
  });
}

async function handleSetStatus(base44, user, payload) {
  const allowedKeys = ['action', 'id', 'status'];
  validatePayloadKeys(payload, allowedKeys, 'setStatus');

  const { id, status } = payload;

  if (!id) {
    throw new Error('id is required');
  }

  const validStatuses = ['draft', 'sent', 'in_transit', 'arrived', 'put_away', 'closed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
  }

  await base44.asServiceRole.entities.PurchaseOrderV2.update(id, { status });

  console.log('[setStatus] Updated PO status:', id, status);

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, id)
  });
}

async function handleSetLines(base44, user, payload) {
  const allowedKeys = ['action', 'id', 'lines'];
  validatePayloadKeys(payload, allowedKeys, 'setLines');

  const { id, lines } = payload;

  if (!id) {
    throw new Error('id is required');
  }

  if (!Array.isArray(lines)) {
    throw new Error('lines must be an array');
  }

  // Delete existing lines
  const existingLines = await base44.asServiceRole.entities.PurchaseOrderLineV2.filter({ 
    purchase_order_v2_id: id 
  });
  
  await Promise.all(
    existingLines.map(line => base44.asServiceRole.entities.PurchaseOrderLineV2.delete(line.id))
  );

  // Create new lines
  const validLines = lines.filter(line => {
    return line.item_name && line.qty > 0;
  });

  const createdLines = await Promise.all(
    validLines.map(line => {
      const lineData = {
        purchase_order_v2_id: id,
        item_name: line.item_name,
        sku: line.sku || null,
        qty: line.qty,
        unit_cost_ex_tax: line.unit_cost_ex_tax || null,
        source_type: line.inventory_item_id ? 'inventory_item' : 'custom',
        inventory_item_id: line.inventory_item_id || null,
        notes: line.notes || null
      };

      return base44.asServiceRole.entities.PurchaseOrderLineV2.create(lineData);
    })
  );

  console.log('[setLines] Replaced lines for PO:', id, `${existingLines.length} → ${createdLines.length}`);

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, id)
  });
}

async function handleReceiveIntoLoadingBay(base44, user, payload) {
  const allowedKeys = ['action', 'id', 'received_lines'];
  validatePayloadKeys(payload, allowedKeys, 'receiveIntoLoadingBay');

  const { id, received_lines } = payload;

  if (!id) {
    throw new Error('id is required');
  }

  if (!Array.isArray(received_lines) || received_lines.length === 0) {
    throw new Error('received_lines must be a non-empty array');
  }

  // Find or create Loading Bay location
  let loadingBay = await base44.asServiceRole.entities.StockLocationV2.filter({ 
    type: 'warehouse',
    name: { $regex: 'Loading Bay', $options: 'i' }
  });

  if (!loadingBay || loadingBay.length === 0) {
    loadingBay = [await base44.asServiceRole.entities.StockLocationV2.create({
      name: 'Loading Bay',
      type: 'warehouse',
      is_active: true
    })];
  }

  const loadingBayLocation = loadingBay[0];

  // Process received lines
  for (const receivedLine of received_lines) {
    const { line_id, received_qty } = receivedLine;

    if (!line_id || !received_qty || received_qty <= 0) {
      continue;
    }

    // Get the line
    const lines = await base44.asServiceRole.entities.PurchaseOrderLineV2.filter({ id: line_id });
    if (!lines || lines.length === 0) {
      console.warn('[receiveIntoLoadingBay] Line not found:', line_id);
      continue;
    }

    const line = lines[0];

    // Only create ledger entry if linked to inventory item
    if (line.inventory_item_id) {
      await base44.asServiceRole.entities.StockLedgerV2.create({
        inventory_item_v2_id: line.inventory_item_id,
        location_v2_id: loadingBayLocation.id,
        qty_delta: received_qty,
        reason: 'receive_po',
        ref_type: 'po_v2',
        ref_id: id,
        note: `Received from PO line ${line_id}`
      });

      console.log('[receiveIntoLoadingBay] Created ledger entry:', line.inventory_item_id, received_qty);
    }
  }

  // Update PO status to arrived
  await base44.asServiceRole.entities.PurchaseOrderV2.update(id, { status: 'arrived' });

  console.log('[receiveIntoLoadingBay] Received PO:', id, `${received_lines.length} lines`);

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, id)
  });
}

async function handleClose(base44, user, payload) {
  const allowedKeys = ['action', 'id'];
  validatePayloadKeys(payload, allowedKeys, 'close');

  const { id } = payload;

  if (!id) {
    throw new Error('id is required');
  }

  // Get PO and lines
  const pos = await base44.asServiceRole.entities.PurchaseOrderV2.filter({ id });
  if (!pos || pos.length === 0) {
    throw new Error('Purchase Order not found');
  }

  await base44.asServiceRole.entities.PurchaseOrderV2.update(id, { status: 'closed' });

  console.log('[close] Closed PO:', id);

  return Response.json({
    success: true,
    purchaseOrder: await getPOWithLines(base44, id)
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate next sequential PO reference (PO-000001 format)
 */
async function generateNextPoRef(base44) {
  const allPOs = await base44.asServiceRole.entities.PurchaseOrderV2.list('-created_date', 1);
  
  if (!allPOs || allPOs.length === 0) {
    return 'PO-000001';
  }

  // Extract number from last PO ref
  const lastRef = allPOs[0].po_ref;
  const match = lastRef?.match(/PO-(\d+)/);
  
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PO-${String(nextNum).padStart(6, '0')}`;
  }

  // Fallback if format doesn't match
  return `PO-${String(allPOs.length + 1).padStart(6, '0')}`;
}

/**
 * Get PO with all its lines
 */
async function getPOWithLines(base44, poId) {
  const pos = await base44.asServiceRole.entities.PurchaseOrderV2.filter({ id: poId });
  
  if (!pos || pos.length === 0) {
    throw new Error('Purchase Order not found');
  }

  const po = pos[0];

  const lines = await base44.asServiceRole.entities.PurchaseOrderLineV2.filter({ 
    purchase_order_v2_id: poId 
  });

  return {
    ...po,
    lines: lines || []
  };
}

/**
 * Validate payload contains only allowed keys
 */
function validatePayloadKeys(payload, allowedKeys, action) {
  const receivedKeys = Object.keys(payload);
  const invalidKeys = receivedKeys.filter(key => !allowedKeys.includes(key));

  console.log('[validatePayloadKeys]', {
    action,
    allowedKeys,
    receivedKeys,
    invalidKeys
  });

  if (invalidKeys.length > 0) {
    throw new Error(
      `Invalid keys for action "${action}": ${invalidKeys.join(', ')}. ` +
      `Allowed keys: ${allowedKeys.join(', ')}`
    );
  }
}