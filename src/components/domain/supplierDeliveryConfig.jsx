/**
 * Supplier Delivery Configuration
 * Normalizes delivery methods and source types
 */

export const DELIVERY_METHOD = {
  PICKUP: "pickup",
  DELIVERY: "delivery",
};

export const DELIVERY_METHOD_OPTIONS = Object.values(DELIVERY_METHOD);

export const SOURCE_TYPE = {
  SUPPLIER_DELIVERY: "supplier_delivery",
  SUPPLIER_PICKUP: "supplier_pickup",
  IN_STOCK: "in_stock",
  CLIENT_SUPPLIED: "client_supplied",
};

export const SOURCE_TYPE_OPTIONS = Object.values(SOURCE_TYPE);

export const SOURCE_TYPE_LABELS = {
  supplier_delivery: "Supplier – Deliver to Warehouse",
  supplier_pickup: "Supplier – Pickup Required",
  in_stock: "In Stock (KGD)",
  client_supplied: "Client Supplied",
};

export function getSourceTypeLabel(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType || "Unknown";
}

// Normalize legacy source type values
export function normaliseLegacySourceType(sourceType) {
  if (!sourceType) return SOURCE_TYPE.SUPPLIER_DELIVERY;

  switch (sourceType.toLowerCase().replace(/\s+/g, "_")) {
    case "supplier_–_deliver_to_warehouse":
    case "supplier_deliver_to_warehouse":
    case "supplier_delivery":
      return SOURCE_TYPE.SUPPLIER_DELIVERY;

    case "supplier_–_pickup_required":
    case "supplier_pickup_required":
    case "supplier_pickup":
      return SOURCE_TYPE.SUPPLIER_PICKUP;

    case "in_stock_(kgd)":
    case "in_stock_kgd":
    case "in_stock":
      return SOURCE_TYPE.IN_STOCK;

    case "client_supplied":
      return SOURCE_TYPE.CLIENT_SUPPLIED;

    default:
      return sourceType;
  }
}