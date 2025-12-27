import { base44 } from "@/api/base44Client";
import { isLegacyPurchasingReadOnly, logLegacyReadOnlyBlock } from "@/config/featureFlags";
import { toast } from "sonner";

/**
 * Thin client wrapper for Purchase Order operations.
 * All PO mutations must go through managePurchaseOrder backend function.
 * 
 * ⚠️ CRITICAL: NEVER use base44.entities.PurchaseOrder.* or PurchaseOrderLine.* directly in frontend.
 * 
 * DEPRECATED COMPONENTS (DO NOT USE):
 * - components/purchasing/SupplierPurchaseOrderModal.js (uses direct entity calls)
 * - components/purchasing/ReceivePurchaseOrderModal.js (uses direct entity calls)
 * 
 * These components bypass the managePurchaseOrder command flow and should be phased out.
 * 
 * READ-ONLY MODE: When LEGACY_PURCHASING_READ_ONLY flag is enabled, all mutations are blocked.
 */

export async function createDraft({ 
  supplier_id, 
  project_id, 
  delivery_method, 
  delivery_location, 
  notes, 
  expected_date, 
  attachments 
}) {
  if (isLegacyPurchasingReadOnly()) {
    logLegacyReadOnlyBlock('purchaseOrdersApi', 'createDraft', { supplier_id, project_id });
    toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
    throw new Error('Legacy purchasing is read-only');
  }
  
  const payload = {
    action: 'createDraft',
    supplier_id,
    project_id,
    delivery_method,
    delivery_location,
    notes,
    expected_date,
    attachments
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to create draft PO');
  }
  
  return response.data.purchaseOrder;
}

export async function updateIdentity({ 
  id, 
  po_reference, 
  name, 
  supplier_id, 
  notes, 
  expected_date 
}) {
  if (isLegacyPurchasingReadOnly()) {
    logLegacyReadOnlyBlock('purchaseOrdersApi', 'updateIdentity', { id });
    toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
    throw new Error('Legacy purchasing is read-only');
  }
  
  const payload = {
    action: 'updateIdentity',
    id,
    po_reference,
    name,
    supplier_id,
    notes,
    expected_date
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to update PO identity');
  }
  
  return response.data.purchaseOrder;
}

export async function updateStatus({ id, status }) {
  if (isLegacyPurchasingReadOnly()) {
    logLegacyReadOnlyBlock('purchaseOrdersApi', 'updateStatus', { id, status });
    toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
    throw new Error('Legacy purchasing is read-only');
  }
  
  const payload = {
    action: 'updateStatus',
    id,
    status
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to update PO status');
  }
  
  return response.data.purchaseOrder;
}

export async function setLineItems({ id, line_items }) {
  if (isLegacyPurchasingReadOnly()) {
    logLegacyReadOnlyBlock('purchaseOrdersApi', 'setLineItems', { id, line_items_count: line_items?.length });
    toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
    throw new Error('Legacy purchasing is read-only');
  }
  
  const payload = {
    action: 'setLineItems',
    id,
    line_items
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to set line items');
  }
  
  return response.data.purchaseOrder;
}

export async function deletePurchaseOrder({ id }) {
  if (isLegacyPurchasingReadOnly()) {
    logLegacyReadOnlyBlock('purchaseOrdersApi', 'deletePurchaseOrder', { id });
    toast.info("Legacy purchasing is read-only. Use Purchasing V2.");
    throw new Error('Legacy purchasing is read-only');
  }
  
  const payload = {
    action: 'delete',
    id
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to delete PO');
  }
  
  return response.data;
}