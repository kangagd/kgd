/**
 * Centralized React Query keys
 * Single source of truth for all query key functions
 */

export const queryKeys = {
  purchaseOrders: () => ['purchaseOrders'],
  purchaseOrder: (id) => ['purchaseOrder', id],
  purchaseOrderLines: (poId) => ['purchaseOrderLines', poId],
  projects: () => ['projects'],
  suppliers: () => ['suppliers'],
  vehicles: () => ['vehicles'],
};