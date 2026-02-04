/**
 * Pure helper functions for displaying ProjectRequirementLine labels in Parts V2
 */

export function buildPriceListItemMap(priceListItems = []) {
  const map = {};
  for (const item of priceListItems) {
    if (item.id) {
      map[item.id] = item;
    }
  }
  return map;
}

export function getRequirementLabel(req, priceListItemMap = {}) {
  if (!req) return 'Unknown Requirement';
  
  // Priority order for display
  if (req.catalog_item_name) return req.catalog_item_name;
  
  // Support both catalog_item_id and price_list_item_id
  const partRefId = req.catalog_item_id || req.price_list_item_id;
  if (partRefId && priceListItemMap[partRefId]) {
    const item = priceListItemMap[partRefId];
    return item.item || item.name || item.item_name || item.title || null;
  }
  
  if (req.description) return req.description;
  if (req.custom_item_name) return req.custom_item_name;
  
  return `Requirement #${req.id?.substring(0, 6) || 'Unknown'}`;
}

export function getRequirementSubtitle(req) {
  const parts = [];
  
  if (req.is_blocking) parts.push('Blocking');
  if (req.priority) parts.push(req.priority);
  if (req.qty_required) parts.push(`Qty: ${req.qty_required}`);
  
  return parts.length > 0 ? parts.join(' • ') : null;
}