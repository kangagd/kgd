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
  
  if (req.catalog_item_id && priceListItemMap[req.catalog_item_id]) {
    const item = priceListItemMap[req.catalog_item_id];
    return item.name || item.item_name || item.item || item.title || null;
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