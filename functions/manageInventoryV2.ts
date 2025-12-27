import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * V2 Inventory Management Function
 * Command-based API for managing inventory items and stock movements
 * 
 * Supported Actions:
 * - createStockItem: Create new inventory item
 * - adjustBalance: Adjust stock at a location (audit via StockLedgerV2)
 * - moveStock: Transfer stock between locations
 * - consumeForProject: Consume stock for a project
 * 
 * Rules:
 * - All stock movements create StockLedgerV2 entries (append-only audit log)
 * - Negative balances are prevented unless user is admin
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

    console.log('[manageInventoryV2]', { action, user: user.email, payload });

    // Route to action handler
    switch (action) {
      case 'createStockItem':
        return await handleCreateStockItem(base44, user, payload);
      case 'adjustBalance':
        return await handleAdjustBalance(base44, user, payload);
      case 'moveStock':
        return await handleMoveStock(base44, user, payload);
      case 'consumeForProject':
        return await handleConsumeForProject(base44, user, payload);
      default:
        return Response.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[manageInventoryV2] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleCreateStockItem(base44, user, payload) {
  const allowedKeys = ['action', 'sku', 'name', 'category', 'unit', 'reorder_point', 'default_supplier_id', 'unit_cost_ex_tax'];
  validatePayloadKeys(payload, allowedKeys, 'createStockItem');

  const { sku, name, category, unit, reorder_point, default_supplier_id, unit_cost_ex_tax } = payload;

  if (!name) {
    throw new Error('name is required');
  }

  const itemData = {
    name,
    sku: sku || null,
    default_supplier_id: default_supplier_id || null,
    unit_cost_ex_tax: unit_cost_ex_tax || null,
    is_active: true
  };

  const item = await base44.asServiceRole.entities.InventoryItemV2.create(itemData);

  console.log('[createStockItem] Created item:', item.id, name);

  return Response.json({
    success: true,
    item
  });
}

async function handleAdjustBalance(base44, user, payload) {
  const allowedKeys = ['action', 'stock_item_id', 'inventory_location_id', 'qty_delta', 'note'];
  validatePayloadKeys(payload, allowedKeys, 'adjustBalance');

  const { stock_item_id, inventory_location_id, qty_delta, note } = payload;

  if (!stock_item_id) {
    throw new Error('stock_item_id is required');
  }

  if (!inventory_location_id) {
    throw new Error('inventory_location_id is required');
  }

  if (qty_delta === undefined || qty_delta === null) {
    throw new Error('qty_delta is required');
  }

  // Check current balance
  const currentBalance = await getStockBalance(base44, stock_item_id, inventory_location_id);
  const newBalance = currentBalance + qty_delta;

  // Prevent negative balance unless admin
  if (newBalance < 0 && user.role !== 'admin') {
    throw new Error(`Insufficient stock. Current: ${currentBalance}, Requested: ${qty_delta}`);
  }

  // Create ledger entry
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: inventory_location_id,
    qty_delta,
    reason: 'adjustment',
    ref_type: 'manual',
    ref_id: user.email,
    note: note || `Manual adjustment by ${user.email}`
  });

  console.log('[adjustBalance] Adjusted:', stock_item_id, inventory_location_id, qty_delta);

  return Response.json({
    success: true,
    previousBalance: currentBalance,
    newBalance: newBalance,
    delta: qty_delta
  });
}

async function handleMoveStock(base44, user, payload) {
  const allowedKeys = ['action', 'stock_item_id', 'from_location_id', 'to_location_id', 'qty', 'note'];
  validatePayloadKeys(payload, allowedKeys, 'moveStock');

  const { stock_item_id, from_location_id, to_location_id, qty, note } = payload;

  if (!stock_item_id) {
    throw new Error('stock_item_id is required');
  }

  if (!from_location_id) {
    throw new Error('from_location_id is required');
  }

  if (!to_location_id) {
    throw new Error('to_location_id is required');
  }

  if (!qty || qty <= 0) {
    throw new Error('qty must be a positive number');
  }

  if (from_location_id === to_location_id) {
    throw new Error('from_location_id and to_location_id cannot be the same');
  }

  // Check source balance
  const sourceBalance = await getStockBalance(base44, stock_item_id, from_location_id);
  
  if (sourceBalance < qty && user.role !== 'admin') {
    throw new Error(`Insufficient stock at source location. Available: ${sourceBalance}, Requested: ${qty}`);
  }

  // Create ledger entries (out from source, in to destination)
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id,
    qty_delta: -qty,
    reason: 'transfer',
    ref_type: 'manual',
    ref_id: `${from_location_id}_to_${to_location_id}`,
    note: note || `Transfer to ${to_location_id}`
  });

  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: to_location_id,
    qty_delta: qty,
    reason: 'transfer',
    ref_type: 'manual',
    ref_id: `${from_location_id}_to_${to_location_id}`,
    note: note || `Transfer from ${from_location_id}`
  });

  console.log('[moveStock] Moved:', stock_item_id, `${from_location_id} → ${to_location_id}`, qty);

  return Response.json({
    success: true,
    moved: {
      item_id: stock_item_id,
      from: from_location_id,
      to: to_location_id,
      qty
    }
  });
}

async function handleConsumeForProject(base44, user, payload) {
  const allowedKeys = ['action', 'project_id', 'stock_item_id', 'from_location_id', 'qty', 'note'];
  validatePayloadKeys(payload, allowedKeys, 'consumeForProject');

  const { project_id, stock_item_id, from_location_id, qty, note } = payload;

  if (!project_id) {
    throw new Error('project_id is required');
  }

  if (!stock_item_id) {
    throw new Error('stock_item_id is required');
  }

  if (!from_location_id) {
    throw new Error('from_location_id is required');
  }

  if (!qty || qty <= 0) {
    throw new Error('qty must be a positive number');
  }

  // Check balance
  const currentBalance = await getStockBalance(base44, stock_item_id, from_location_id);
  
  if (currentBalance < qty && user.role !== 'admin') {
    throw new Error(`Insufficient stock. Available: ${currentBalance}, Requested: ${qty}`);
  }

  // Create ledger entry (consumption)
  await base44.asServiceRole.entities.StockLedgerV2.create({
    inventory_item_v2_id: stock_item_id,
    location_v2_id: from_location_id,
    qty_delta: -qty,
    reason: 'allocate_project',
    ref_type: 'project',
    ref_id: project_id,
    note: note || `Consumed for project ${project_id}`
  });

  console.log('[consumeForProject] Consumed:', stock_item_id, project_id, qty);

  return Response.json({
    success: true,
    consumed: {
      item_id: stock_item_id,
      project_id,
      location_id: from_location_id,
      qty
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate current stock balance for an item at a location
 * by summing all StockLedgerV2 entries
 */
async function getStockBalance(base44, itemId, locationId) {
  const entries = await base44.asServiceRole.entities.StockLedgerV2.filter({
    inventory_item_v2_id: itemId,
    location_v2_id: locationId
  });

  if (!entries || entries.length === 0) {
    return 0;
  }

  const balance = entries.reduce((sum, entry) => sum + (entry.qty_delta || 0), 0);
  
  return balance;
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