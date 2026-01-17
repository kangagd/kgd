import { base44 } from "@/api/base44Client";

/**
 * Calculate inbound quantity for a specific SKU
 * Inbound = SUM(qty_ordered - qty_received) for open POs
 * 
 * @param {string} skuId - PriceListItem ID
 * @returns {Promise<number>} Inbound quantity
 */
export async function calculateInboundQty(skuId) {
  if (!skuId) return 0;

  try {
    // Get all open POs
    const openPOs = await base44.entities.PurchaseOrder.filter({
      status: { $ne: 'cancelled' }
    });

    if (openPOs.length === 0) return 0;

    // For each open PO, sum qty_ordered - qty_received for matching line items
    let totalInbound = 0;

    for (const po of openPOs) {
      const lines = await base44.entities.PurchaseOrderLine.filter({
        purchase_order_id: po.id,
        source_id: skuId
      });

      for (const line of lines) {
        const outstanding = (line.qty_ordered || 0) - (line.qty_received || 0);
        if (outstanding > 0) {
          totalInbound += outstanding;
        }
      }
    }

    return totalInbound;
  } catch (error) {
    console.error('[inboundInventoryHelper] Error calculating inbound:', error);
    return 0;
  }
}

/**
 * Calculate on-hand quantity for a specific SKU
 * On Hand = SUM(InventoryQuantity.quantity) for physical available locations ONLY (warehouse + vehicle)
 * Does NOT include loading_bay, in_transit, supplier, or inactive locations
 * 
 * @param {string} skuId - PriceListItem ID
 * @returns {Promise<number>} On-hand quantity
 */
export async function calculateOnHandQty(skuId) {
  if (!skuId) return 0;

  try {
    const { isPhysicalAvailableLocation } = await import('@/components/utils/inventoryLocationUtils');
    
    // Get ALL locations and filter to only physical available ones
    const allLocations = await base44.entities.InventoryLocation.filter({});
    const physicalLocations = allLocations.filter(isPhysicalAvailableLocation);

    if (physicalLocations.length === 0) return 0;

    let totalOnHand = 0;

    for (const location of physicalLocations) {
      const quantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: skuId,
        location_id: location.id
      });

      for (const qty of quantities) {
        totalOnHand += qty.quantity || 0;
      }
    }

    return totalOnHand;
  } catch (error) {
    console.error('[inboundInventoryHelper] Error calculating on-hand:', error);
    return 0;
  }
}

/**
 * Get complete stock view for a SKU: on-hand + inbound
 * 
 * @param {string} skuId - PriceListItem ID
 * @returns {Promise<Object>} { onHand, inbound, total }
 */
export async function getStockView(skuId) {
  const [onHand, inbound] = await Promise.all([
    calculateOnHandQty(skuId),
    calculateInboundQty(skuId)
  ]);

  return {
    onHand,
    inbound,
    total: onHand + inbound
  };
}