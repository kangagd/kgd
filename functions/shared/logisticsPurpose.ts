/**
 * Canonical logistics purpose enum.
 * Used consistently across frontend, backend functions, and database rules.
 */

export const LOGISTICS_PURPOSE = {
  PO_DELIVERY_TO_WAREHOUSE: 'po_delivery_to_warehouse',
  PO_PICKUP_FROM_SUPPLIER: 'po_pickup_from_supplier',
  PART_PICKUP_FOR_INSTALL: 'part_pickup_for_install',
  MANUAL_CLIENT_DROPOFF: 'manual_client_dropoff',
  SAMPLE_DROPOFF: 'sample_dropoff',
  SAMPLE_PICKUP: 'sample_pickup',
};

export const ALL_LOGISTICS_PURPOSES = Object.values(LOGISTICS_PURPOSE);