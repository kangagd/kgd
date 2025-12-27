import { base44 } from "@/api/base44Client";

/**
 * V2 Purchase Order API Client
 * Wrapper for managePurchaseOrderV2 backend function
 */

export async function createDraft({ type, project_id, supplier_id }) {
  const response = await base44.functions.invoke('managePurchaseOrderV2', {
    action: 'createDraft',
    type,
    project_id,
    supplier_id
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to create draft PO');
  }

  return response.data.purchaseOrder;
}

export async function updateHeader({ id, supplier_id, expected_date, notes, name, delivery_method, delivery_location }) {
  const payload = {
    action: 'updateHeader',
    id
  };

  if (supplier_id !== undefined) payload.supplier_id = supplier_id;
  if (expected_date !== undefined) payload.expected_date = expected_date;
  if (notes !== undefined) payload.notes = notes;
  if (name !== undefined) payload.name = name;
  if (delivery_method !== undefined) payload.delivery_method = delivery_method;
  if (delivery_location !== undefined) payload.delivery_location = delivery_location;

  const response = await base44.functions.invoke('managePurchaseOrderV2', payload);

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to update PO header');
  }

  return response.data.purchaseOrder;
}

export async function setStatus({ id, status }) {
  const response = await base44.functions.invoke('managePurchaseOrderV2', {
    action: 'setStatus',
    id,
    status
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to update PO status');
  }

  return response.data.purchaseOrder;
}

export async function setLines({ id, lines }) {
  const response = await base44.functions.invoke('managePurchaseOrderV2', {
    action: 'setLines',
    id,
    lines
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to set PO lines');
  }

  return response.data.purchaseOrder;
}

export async function receiveIntoLoadingBay({ id, received_lines }) {
  const response = await base44.functions.invoke('managePurchaseOrderV2', {
    action: 'receiveIntoLoadingBay',
    id,
    received_lines
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to receive PO');
  }

  return response.data.purchaseOrder;
}

export async function close({ id }) {
  const response = await base44.functions.invoke('managePurchaseOrderV2', {
    action: 'close',
    id
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to close PO');
  }

  return response.data.purchaseOrder;
}