import { base44 } from "@/api/base44Client";

/**
 * V2 Inventory API Client
 * Wrapper for manageInventoryV2 backend function
 */

export async function createStockItem({ sku, name, category, unit, reorder_point, default_supplier_id, unit_cost_ex_tax }) {
  const payload = {
    action: 'createStockItem',
    name
  };

  if (sku !== undefined) payload.sku = sku;
  if (category !== undefined) payload.category = category;
  if (unit !== undefined) payload.unit = unit;
  if (reorder_point !== undefined) payload.reorder_point = reorder_point;
  if (default_supplier_id !== undefined) payload.default_supplier_id = default_supplier_id;
  if (unit_cost_ex_tax !== undefined) payload.unit_cost_ex_tax = unit_cost_ex_tax;

  const response = await base44.functions.invoke('manageInventoryV2', payload);

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to create stock item');
  }

  return response.data.item;
}

export async function adjustBalance({ stock_item_id, inventory_location_id, qty_delta, note }) {
  const payload = {
    action: 'adjustBalance',
    stock_item_id,
    inventory_location_id,
    qty_delta
  };

  if (note !== undefined) payload.note = note;

  const response = await base44.functions.invoke('manageInventoryV2', payload);

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to adjust balance');
  }

  return response.data;
}

export async function moveStock({ stock_item_id, from_location_id, to_location_id, qty, note }) {
  const payload = {
    action: 'moveStock',
    stock_item_id,
    from_location_id,
    to_location_id,
    qty
  };

  if (note !== undefined) payload.note = note;

  const response = await base44.functions.invoke('manageInventoryV2', payload);

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to move stock');
  }

  return response.data;
}

export async function consumeForProject({ project_id, stock_item_id, from_location_id, qty, note }) {
  const payload = {
    action: 'consumeForProject',
    project_id,
    stock_item_id,
    from_location_id,
    qty
  };

  if (note !== undefined) payload.note = note;

  const response = await base44.functions.invoke('manageInventoryV2', payload);

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to consume stock');
  }

  return response.data;
}