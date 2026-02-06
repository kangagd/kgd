
// Central source of truth for backend function entrypoints.
// Update versions here only (avoid hardcoded strings scattered across UI).
// Prevents "fixed then rolled back" via accidental legacy calls.

export const BackendFn = {
  // Purchase Orders & Logistics
  managePurchaseOrderStatus: "managePurchaseOrder_v20260129",

  // Xero
  processXeroPayment: "processXeroPayment_v20260129",
};
