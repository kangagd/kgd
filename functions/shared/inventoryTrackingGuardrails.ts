/**
 * Guardrails for inventory-tracked items
 * Prevents custom PO lines without price_list_item_id from entering physical inventory flows
 */

/**
 * Check if a PO line or Part can be received/moved physically
 * @param {Object} item - PO line or Part object
 * @returns {Object} { isInventoryTracked: boolean, reason: string | null }
 */
export function checkInventoryTrackability(item) {
  if (!item) {
    return {
      isInventoryTracked: false,
      reason: 'Item not found'
    };
  }

  // Custom lines/parts without price_list_item_id cannot be tracked
  if (!item.price_list_item_id) {
    return {
      isInventoryTracked: false,
      reason: 'Custom line cannot be received/moved into inventory. Convert to a Price List Item or mark informational.'
    };
  }

  return {
    isInventoryTracked: true,
    reason: null
  };
}

/**
 * Filter items into inventory-tracked and non-tracked
 * @param {Array} items - Array of items to check
 * @returns {Object} { tracked: [], untracked: [] }
 */
export function separateInventoryTrackableItems(items) {
  const tracked = [];
  const untracked = [];

  for (const item of items) {
    const check = checkInventoryTrackability(item);
    if (check.isInventoryTracked) {
      tracked.push(item);
    } else {
      untracked.push({
        ...item,
        warning: check.reason
      });
    }
  }

  return { tracked, untracked };
}