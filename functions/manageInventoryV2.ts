import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VALID_ACTIONS = [
  'createStockItem',
  'adjustBalance',
  'moveStock',
  'consumeForProject'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action } = payload;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return Response.json({
        success: false,
        error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`
      }, { status: 400 });
    }

    console.log(`[manageInventoryV2] Action: ${action}`, payload);

    // Route to action handlers
    switch (action) {
      case 'createStockItem':
        return await handleCreateStockItem(base44, payload);
      case 'adjustBalance':
        return await handleAdjustBalance(base44, payload);
      case 'moveStock':
        return await handleMoveStock(base44, payload);
      case 'consumeForProject':
        return await handleConsumeForProject(base44, payload);
      default:
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[manageInventoryV2] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});

// Create new stock item
async function handleCreateStockItem(base44, payload) {
  const { name, sku, category, unit, reorder_point, default_supplier_id, unit_cost_ex_tax } = payload;

  if (!name) {
    return Response.json({ success: false, error: 'name is required' }, { status: 400 });
  }

  const itemData = {
    name,
    is_active: true
  };

  if (sku) itemData.sku = sku;
  if (category) itemData.category = category;
  if (unit) itemData.unit = unit;
  if (reorder_point !== undefined) itemData.reorder_point = reorder_point;
  if (default_supplier_id) itemData.default_supplier_id = default_supplier_id;
  if (unit_cost_ex_tax !== undefined) itemData.unit_cost_ex_tax = unit_cost_ex_tax;

  const item = await base44.asServiceRole.entities.InventoryItemV2.create(itemData);

  console.log(`[manageInventoryV2] Created stock item:`, item.id);

  return Response.json({ success: true, item });
}

// Adjust balance at a location
async function handleAdjustBalance(base44, payload) {
  const { stock_item_id, inventory_location_id, qty_delta, note } = payload;

  if (!stock_item_id || !inventory_location_id || qty_delta === undefined) {
    return Response.json({
      success: false,
      error: 'stock_item_id, inventory_location_id, and qty_delta are required'
    }, { status: 400 });
  }

  // Get or create balance record
  const existingBalances = await base44.asServiceRole.entities.InventoryBalance.filter({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: inventory_location_id
  });

  let balance;
  if (existingBalances.length > 0) {
    balance = existingBalances[0];
    const newQty = (balance.qty_on_hand || 0) + qty_delta;
    await base44.asServiceRole.entities.InventoryBalance.update(balance.id, {
      qty_on_hand: newQty
    });
  } else {
    balance = await base44.asServiceRole.entities.InventoryBalance.create({
      inventory_item_v2_id: stock_item_id,
      location_v2_id: inventory_location_id,
      qty_on_hand: qty_delta
    });
  }

  // Record ledger entry
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: inventory_location_id,
    qty_delta,
    reason: 'adjustment',
    ref_type: 'manual',
    note: note || 'Manual adjustment'
  });

  console.log(`[manageInventoryV2] Adjusted balance for item ${stock_item_id} at ${inventory_location_id}: ${qty_delta}`);

  return Response.json({ success: true });
}

// Move stock between locations
async function handleMoveStock(base44, payload) {
  const { stock_item_id, from_location_id, to_location_id, qty, note } = payload;

  if (!stock_item_id || !from_location_id || !to_location_id || !qty) {
    return Response.json({
      success: false,
      error: 'stock_item_id, from_location_id, to_location_id, and qty are required'
    }, { status: 400 });
  }

  if (qty <= 0) {
    return Response.json({ success: false, error: 'qty must be positive' }, { status: 400 });
  }

  // Check from location has sufficient stock
  const fromBalances = await base44.asServiceRole.entities.InventoryBalance.filter({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id
  });

  if (fromBalances.length === 0 || (fromBalances[0].qty_on_hand || 0) < qty) {
    return Response.json({ success: false, error: 'Insufficient stock at source location' }, { status: 400 });
  }

  // Deduct from source
  const fromBalance = fromBalances[0];
  await base44.asServiceRole.entities.InventoryBalance.update(fromBalance.id, {
    qty_on_hand: (fromBalance.qty_on_hand || 0) - qty
  });

  // Add to destination
  const toBalances = await base44.asServiceRole.entities.InventoryBalance.filter({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: to_location_id
  });

  if (toBalances.length > 0) {
    await base44.asServiceRole.entities.InventoryBalance.update(toBalances[0].id, {
      qty_on_hand: (toBalances[0].qty_on_hand || 0) + qty
    });
  } else {
    await base44.asServiceRole.entities.InventoryBalance.create({
      inventory_item_v2_id: stock_item_id,
      location_v2_id: to_location_id,
      qty_on_hand: qty
    });
  }

  // Record ledger entries
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id,
    qty_delta: -qty,
    reason: 'transfer',
    ref_type: 'manual',
    note: note || `Transfer to location ${to_location_id}`
  });

  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: to_location_id,
    qty_delta: qty,
    reason: 'transfer',
    ref_type: 'manual',
    note: note || `Transfer from location ${from_location_id}`
  });

  console.log(`[manageInventoryV2] Moved ${qty} units from ${from_location_id} to ${to_location_id}`);

  return Response.json({ success: true });
}

// Consume stock for a project
async function handleConsumeForProject(base44, payload) {
  const { project_id, stock_item_id, from_location_id, qty, note } = payload;

  if (!project_id || !stock_item_id || !from_location_id || !qty) {
    return Response.json({
      success: false,
      error: 'project_id, stock_item_id, from_location_id, and qty are required'
    }, { status: 400 });
  }

  if (qty <= 0) {
    return Response.json({ success: false, error: 'qty must be positive' }, { status: 400 });
  }

  // Check location has sufficient stock
  const balances = await base44.asServiceRole.entities.InventoryBalance.filter({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id
  });

  if (balances.length === 0 || (balances[0].qty_on_hand || 0) < qty) {
    return Response.json({ success: false, error: 'Insufficient stock at location' }, { status: 400 });
  }

  // Deduct stock
  const balance = balances[0];
  await base44.asServiceRole.entities.InventoryBalance.update(balance.id, {
    qty_on_hand: (balance.qty_on_hand || 0) - qty
  });

  // Record ledger entry
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id,
    qty_delta: -qty,
    reason: 'consume_job',
    ref_type: 'project',
    ref_id: project_id,
    note: note || `Consumed for project ${project_id}`
  });

  console.log(`[manageInventoryV2] Consumed ${qty} units for project ${project_id}`);

  return Response.json({ success: true });
}