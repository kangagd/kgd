/**
 * Unified Part Label Resolver for Parts V2
 * 
 * Handles the complexity of part references across entities:
 * - Some entities use catalog_item_id, others use price_list_item_id
 * - Some cache catalog_item_name, others don't
 * 
 * This resolver provides a single point of truth for label resolution.
 */

/**
 * Check if a label is a placeholder value that should be ignored
 * @param {string} label - The label to check
 * @returns {boolean} True if the label is a placeholder
 */
export const isPlaceholderLabel = (label) => {
  if (!label || typeof label !== 'string') return true;
  
  const normalized = label.trim().toLowerCase();
  
  // Empty or very short
  if (normalized.length === 0 || normalized === '-') return true;
  
  // Common placeholders
  const placeholders = ['part', 'item', 'unknown', 'n/a', 'na'];
  if (placeholders.includes(normalized)) return true;
  
  // Raw ID-like strings (12+ hex chars)
  if (/^[a-f0-9]{12,}$/.test(normalized)) return true;
  
  return false;
};

/**
 * Get the price list item ID from any record
 * Supports both catalog_item_id and price_list_item_id fields
 */
export const getPartRefId = (record) => {
  return record?.catalog_item_id || record?.price_list_item_id || record?.sku_id || null;
};

/**
 * Resolve a display label for a part reference
 * 
 * @param {Object} record - The record (allocation, consumption, requirement, etc.)
 * @param {Object} priceListItemMap - Map of id -> PriceListItem
 * @returns {string} Display label for the part
 */
export const resolvePartLabel = (record, priceListItemMap = {}) => {
  if (!record) return 'Part';
  
  // 1. Try cached names first, BUT skip if they're placeholders
  if (record.catalog_item_name && !isPlaceholderLabel(record.catalog_item_name)) {
    return record.catalog_item_name;
  }
  if (record.price_list_item_name && !isPlaceholderLabel(record.price_list_item_name)) {
    return record.price_list_item_name;
  }
  if (record.item_name && !isPlaceholderLabel(record.item_name)) {
    return record.item_name;
  }
  
  // 2. Try to lookup in price list map
  const partRefId = getPartRefId(record);
  if (partRefId && priceListItemMap[partRefId]) {
    const item = priceListItemMap[partRefId];
    // Support multiple possible field names for item label
    const itemLabel = item.item || item.name || item.title;
    if (itemLabel && !isPlaceholderLabel(itemLabel)) {
      return itemLabel;
    }
  }
  
  // 3. Try description field (for ad-hoc items)
  if (record.description && !isPlaceholderLabel(record.description)) {
    return record.description;
  }
  
  // 4. Last resort: truncated ID or generic fallback
  if (partRefId) {
    return `Part ${partRefId.substring(partRefId.length - 6)}`;
  }
  return 'Part';
};

/**
 * Get cached fields to persist when creating/updating records
 * 
 * @param {Object} priceListItem - The selected PriceListItem
 * @returns {Object} { catalog_item_id, catalog_item_name }
 */
export const getPartCachedFields = (priceListItem) => {
  if (!priceListItem) return { catalog_item_id: null, catalog_item_name: null };
  
  return {
    catalog_item_id: priceListItem.id,
    catalog_item_name: priceListItem.item || priceListItem.name || priceListItem.title || null,
  };
};