/**
 * Shared Exports Barrel
 * SINGLE SOURCE OF TRUTH for all shared utilities, constants, and helpers
 * All modules must import from this barrel to ensure consistent resolution
 */

// ===== CONSTANTS =====
export const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  AT_SUPPLIER: "at_supplier",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

export const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

export const PO_DELIVERY_METHOD = {
  DELIVERY: "delivery",
  PICKUP: "pickup",
};

// ===== HELPERS: PO Reference Resolution =====
export function firstNonEmpty(...values) {
  for (const val of values) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

export function resolvePoRef({ data, po_reference, po_number, reference, order_reference }) {
  return firstNonEmpty(
    po_reference,
    data?.po_reference,
    po_number,
    data?.po_number,
    order_reference,
    data?.order_reference,
    reference,
    data?.reference
  );
}

// ===== HELPERS: Status Normalization =====
export function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;
  const normalized = status.toLowerCase().trim().replace(/[\s_-]/g, '');
  switch (normalized) {
    case "draft": return PO_STATUS.DRAFT;
    case "sent": return PO_STATUS.SENT;
    case "onorder": return PO_STATUS.ON_ORDER;
    case "partiallyreceived":
    case "intransit": return PO_STATUS.IN_TRANSIT;
    case "received":
    case "delivered":
    case "deliveredloadingbay":
    case "deliveredtodeliverybay":
    case "deliveredtoloadingbay":
    case "readyforpickup":
    case "readytopickup":
    case "arrived":
    case "atdeliverybay":
    case "indeliverybay":
    case "loadingbay":
    case "inloadingbay": return PO_STATUS.IN_LOADING_BAY;
    case "atsupplier": return PO_STATUS.AT_SUPPLIER;
    case "instorage":
    case "completedinstorage": return PO_STATUS.IN_STORAGE;
    case "invehicle":
    case "completedinvehicle": return PO_STATUS.IN_VEHICLE;
    case "installed": return PO_STATUS.INSTALLED;
    case "cancelled": return PO_STATUS.CANCELLED;
    default: return status;
  }
}

// ===== HELPERS: Part/PO Status Mapping =====
export function mapPoStatusToPartStatus(poStatus) {
  switch (poStatus) {
    case PO_STATUS.DRAFT: return PART_STATUS.PENDING;
    case PO_STATUS.SENT:
    case PO_STATUS.ON_ORDER: return PART_STATUS.ON_ORDER;
    case PO_STATUS.IN_TRANSIT: return PART_STATUS.IN_TRANSIT;
    case PO_STATUS.IN_LOADING_BAY: return PART_STATUS.IN_LOADING_BAY;
    case PO_STATUS.AT_SUPPLIER: return PART_STATUS.AT_SUPPLIER;
    case PO_STATUS.IN_STORAGE: return PART_STATUS.IN_STORAGE;
    case PO_STATUS.IN_VEHICLE: return PART_STATUS.IN_VEHICLE;
    case PO_STATUS.INSTALLED: return PART_STATUS.INSTALLED;
    case PO_STATUS.CANCELLED: return PART_STATUS.PENDING;
    default: return PART_STATUS.PENDING;
  }
}

// ===== HELPERS: Parts Linking =====
export async function linkPartsToPO(base44, purchaseOrderId, lineItems) {
  const today = new Date().toISOString().split('T')[0];
  const partIds = lineItems.map(item => item.part_id).filter(Boolean);
  if (partIds.length === 0) return;

  const uniquePartIds = [...new Set(partIds)];
  const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
    purchase_order_id: purchaseOrderId 
  });
  const poLineByPartId = new Map(poLines.map(line => [line.part_id, line]));
  const poLineBySourceId = new Map(poLines.map(line => [line.source_id, line]));

  for (const partId of uniquePartIds) {
    try {
      const part = await base44.asServiceRole.entities.Part.get(partId);
      if (!part) continue;

      const updateData = {
        last_synced_from_po_at: new Date().toISOString(),
        synced_by: 'system:linkPartsToPO'
      };

      let poLine = poLineByPartId.get(partId);
      if (!poLine && part.id) {
        poLine = poLineBySourceId.get(part.id);
      }
      
      if (poLine) {
        if (poLine.item_name) {
          updateData.item_name = poLine.item_name;
        }
        updateData.po_line_id = poLine.id;
        if (poLine.qty_ordered) {
          updateData.quantity_required = poLine.qty_ordered;
        }
      }

      const existingPoIds = Array.isArray(part.purchase_order_ids) ? [...part.purchase_order_ids] : [];
      if (!existingPoIds.includes(purchaseOrderId)) {
        existingPoIds.push(purchaseOrderId);
      }
      updateData.purchase_order_ids = existingPoIds;

      if (!part.primary_purchase_order_id) {
        updateData.primary_purchase_order_id = purchaseOrderId;
      } else if (part.primary_purchase_order_id !== purchaseOrderId) {
        console.warn(`[linkPartsToPO] Part ${partId} already has primary PO ${part.primary_purchase_order_id}, adding ${purchaseOrderId} to array only`);
      }

      if (part.status === PART_STATUS.PENDING || part.status === "Pending") {
        updateData.status = PART_STATUS.ON_ORDER;
      }

      if (!part.order_date) {
        updateData.order_date = today;
      }

      if (!part.location) {
        updateData.location = PART_LOCATION.SUPPLIER;
      }

      if (updateData.primary_purchase_order_id) {
        updateData.purchase_order_id = updateData.primary_purchase_order_id;
      }

      await base44.asServiceRole.entities.Part.update(partId, updateData);
      console.log(`[linkPartsToPO] Linked part ${partId} to PO ${purchaseOrderId} (primary=${updateData.primary_purchase_order_id}, item_name=${updateData.item_name})`);
    } catch (error) {
      console.error(`Error linking part ${partId} to PO ${purchaseOrderId}:`, error);
    }
  }
}

// ===== DEV-ONLY: Export Validation =====
export function assertSharedExports() {
  const required = [
    'PO_STATUS',
    'PART_STATUS',
    'PART_LOCATION',
    'PO_DELIVERY_METHOD',
    'firstNonEmpty',
    'resolvePoRef',
    'normaliseLegacyPoStatus',
    'mapPoStatusToPartStatus',
    'linkPartsToPO'
  ];

  for (const exportName of required) {
    const exp = this[exportName];
    if (!exp) {
      throw new Error(`[assertSharedExports] Missing export: ${exportName}`);
    }
  }

  console.log('[assertSharedExports] All shared exports validated');
  return true;
}