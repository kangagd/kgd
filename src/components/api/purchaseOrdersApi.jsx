import { base44 } from "@/api/base44Client";

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

export async function manageLineItems({ id, line_items }) {
  const payload = {
    action: 'manageLineItems',
    id,
    line_items
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to manage line items');
  }
  
  return response.data.purchaseOrder;
}

export async function deletePurchaseOrder({ id }) {
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

export async function getOrCreateProjectSupplierDraft({ project_id, supplier_id }) {
  const payload = {
    action: 'getOrCreateProjectSupplierDraft',
    project_id,
    supplier_id
  };
  
  console.log("[PO UI] invoking", payload);
  const response = await base44.functions.invoke('managePurchaseOrder', payload);
  
  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to get/create project supplier draft');
  }
  
  return response.data.purchaseOrder;
}