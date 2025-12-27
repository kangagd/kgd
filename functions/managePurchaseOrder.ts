import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { updateProjectActivity } from './updateProjectActivity.js';

// Canonical PO status values (stored in DB)
const PO_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

// Normalize legacy status values to canonical ones
function normaliseLegacyPoStatus(status) {
  if (!status) return PO_STATUS.DRAFT;

  switch (status.toLowerCase()) {
    case "draft":
      return PO_STATUS.DRAFT;
    
    case "sent":
      return PO_STATUS.SENT;

    case "on_order":
    case "on order":
      return PO_STATUS.ON_ORDER;

    case "partially_received":
    case "in_transit":
    case "in transit":
      return PO_STATUS.IN_TRANSIT;

    case "received":
    case "delivered":
    case "delivered - loading bay":
    case "delivered_loading_bay":
    case "delivered to delivery bay":
    case "delivered to loading bay":
    case "delivered_to_delivery_bay":
    case "ready for pick up":
    case "ready to pick up":
    case "ready_to_pick_up":
    case "arrived":
    case "at_delivery_bay":
    case "at delivery bay":
    case "in_delivery_bay":
    case "in delivery bay":
    case "loadingbay":
    case "in_loading_bay":
    case "in loading bay":
      return PO_STATUS.IN_LOADING_BAY;

    case "in_storage":
    case "in storage":
    case "completed - in storage":
      return PO_STATUS.IN_STORAGE;

    case "in_vehicle":
    case "in vehicle":
    case "completed - in vehicle":
      return PO_STATUS.IN_VEHICLE;

    case "installed":
      return PO_STATUS.INSTALLED;

    case "cancelled":
      return PO_STATUS.CANCELLED;

    default:
      return status;
  }
}

const PO_DELIVERY_METHOD = {
    DELIVERY: "delivery",
    PICKUP: "pickup",
};

// Helper: firstNonEmpty for reference resolution
function firstNonEmpty(...values) {
  for (const val of values) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

// Resolve and normalize PO reference - CANONICAL FIELD ENFORCER
// This ensures po_reference is the single source of truth
function resolvePoRef({ data, po_reference, po_number, reference, order_reference }) {
  const canonical = firstNonEmpty(
    po_reference,
    data?.po_reference,
    po_number,
    data?.po_number,
    order_reference,
    data?.order_reference,
    reference,
    data?.reference
  );
  return canonical;
}

// Normalize PO data to enforce canonical reference
// Sets po_reference as canonical and mirrors to all legacy fields
function normalizePOReferences(poData) {
  const canonical = resolvePoRef(poData);
  
  if (!canonical) {
    // If no reference provided, leave fields as-is or null
    return {
      ...poData,
      po_reference: poData.po_reference || null,
      po_number: poData.po_reference || null,
      order_reference: poData.po_reference || null,
      reference: poData.po_reference || null,
    };
  }
  
  // Set canonical and mirror to all legacy fields
  return {
    ...poData,
    po_reference: canonical,
    po_number: canonical,
    order_reference: canonical,
    reference: canonical,
  };
}

const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

// Helper: Link Parts to PO
async function linkPartsToPO(base44, purchaseOrderId, lineItems) {
    const today = new Date().toISOString().split('T')[0];
    const partIds = lineItems.map(item => item.part_id).filter(Boolean);
    
    if (partIds.length === 0) return;

    // Get unique part IDs
    const uniquePartIds = [...new Set(partIds)];

    for (const partId of uniquePartIds) {
        try {
            const part = await base44.asServiceRole.entities.Part.get(partId);
            if (!part) continue;

            // Skip if part already linked to a different PO
            if (part.purchase_order_id && part.purchase_order_id !== purchaseOrderId) {
                continue;
            }

            const updateData = {
                purchase_order_id: purchaseOrderId
            };

            // Update status if currently pending
            if (part.status === PART_STATUS.PENDING || part.status === "Pending") {
                updateData.status = PART_STATUS.ON_ORDER;
            }

            // Set order_date if empty
            if (!part.order_date) {
                updateData.order_date = today;
            }

            // Set location if empty
            if (!part.location) {
                updateData.location = PART_LOCATION.SUPPLIER;
            }

            await base44.asServiceRole.entities.Part.update(partId, updateData);
        } catch (error) {
            console.error(`Error linking part ${partId} to PO ${purchaseOrderId}:`, error);
        }
    }
}

// Helper: Map PO status to Part status
function mapPoStatusToPartStatus(poStatus) {
    const normalized = normaliseLegacyPoStatus(poStatus);
    
    switch (normalized) {
        case PO_STATUS.DRAFT:
            return PART_STATUS.PENDING;
        
        case PO_STATUS.SENT:
        case PO_STATUS.ON_ORDER:
            return PART_STATUS.ON_ORDER;
        
        case PO_STATUS.IN_TRANSIT:
            return PART_STATUS.IN_TRANSIT;
        
        case PO_STATUS.IN_LOADING_BAY:
            return PART_STATUS.IN_LOADING_BAY;
        
        case PO_STATUS.IN_STORAGE:
            return PART_STATUS.IN_STORAGE;
        
        case PO_STATUS.IN_VEHICLE:
            return PART_STATUS.IN_VEHICLE;
        
        case PO_STATUS.INSTALLED:
            return PART_STATUS.INSTALLED;
        
        case PO_STATUS.CANCELLED:
            return PART_STATUS.PENDING;
        
        default:
            return PART_STATUS.PENDING;
    }
}

// Helper: Sync Parts with PurchaseOrder status
async function syncPartsWithPurchaseOrderStatus(base44, purchaseOrder, vehicleId = null) {
    try {
        // Normalize the status first
        const normalizedStatus = normaliseLegacyPoStatus(purchaseOrder.status);
        
        // Fetch Parts linked to this PO
        const parts = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: purchaseOrder.id
        });

        if (parts.length === 0) return;

        // Determine target part status from PO status
        const targetPartStatus = mapPoStatusToPartStatus(normalizedStatus);

        for (const part of parts) {
            const updateData = {
                status: targetPartStatus
            };

            // Clear ordering metadata if reverting to pending (draft)
            if (targetPartStatus === PART_STATUS.PENDING) {
                updateData.order_date = null;
                updateData.eta = null;
            }

            // CRITICAL: Parts must stay at supplier until physically received
            // Apply location mapping based on PO status
            switch (normalizedStatus) {
                case PO_STATUS.DRAFT:
                case PO_STATUS.SENT:
                case PO_STATUS.ON_ORDER:
                case PO_STATUS.IN_TRANSIT:
                    // Parts remain at supplier - NOT AVAILABLE for picking
                    updateData.location = PART_LOCATION.SUPPLIER;
                    break;

                case PO_STATUS.IN_LOADING_BAY:
                    // Arrived but not put away - NOT YET AVAILABLE for picking
                    updateData.location = PART_LOCATION.LOADING_BAY;
                    break;

                case PO_STATUS.IN_STORAGE:
                    // AVAILABLE - parts can now be picked
                    updateData.location = PART_LOCATION.WAREHOUSE_STORAGE;
                    break;

                case PO_STATUS.IN_VEHICLE:
                    // AVAILABLE - parts loaded in vehicle
                    updateData.location = PART_LOCATION.VEHICLE;
                    if (vehicleId) {
                        updateData.assigned_vehicle_id = vehicleId;
                    }
                    break;

                case PO_STATUS.INSTALLED:
                    updateData.location = PART_LOCATION.CLIENT_SITE;
                    break;
            }

            await base44.asServiceRole.entities.Part.update(part.id, updateData);
        }
    } catch (error) {
        console.error(`Error syncing parts with PO ${purchaseOrder.id} status:`, error);
    }
}

/**
 * Sync Part references when PO reference changes
 * PERMANENT GUARDRAIL: Keeps part.po_number and part.order_reference in sync with PO.po_reference
 */
async function syncPartReferencesWithPO(base44, po) {
    if (!po?.id) return;

    try {
        const parts = await base44.asServiceRole.entities.Part.filter({
            purchase_order_id: po.id,
        });

        const canonicalRef = po.po_reference || null;

        for (const part of parts) {
            // Only update if references don't match
            if (part.po_number === canonicalRef && part.order_reference === canonicalRef) {
                continue;
            }

            const updates = {
                po_number: canonicalRef,
                order_reference: canonicalRef,
            };

            await base44.asServiceRole.entities.Part.update(part.id, updates);
            console.log(`[PO] Synced Part ${part.id} reference to ${canonicalRef} (PO: ${po.id})`);
        }
    } catch (error) {
        console.error(`[PO] Error syncing Part references for PO ${po.id}:`, error);
    }
}

// Helper: Build line item data with auto-population from source entities
async function buildLineItemData(base44, purchaseOrderId, item) {
    const sourceType = item.source_type || "custom";
    const sourceId = item.source_id || item.price_list_item_id || item.part_id || null;
    const partId = item.part_id || null;
    
    let itemName = item.name || item.item_name || item.description || '';
    let unitPrice = item.unit_price || item.price || item.unit_cost_ex_tax || 0;
    let unit = item.unit || null;
    
    // Auto-populate from source if name/price not provided
    if (sourceId && (!itemName || !unitPrice)) {
        try {
            if (sourceType === "price_list") {
                const priceListItem = await base44.asServiceRole.entities.PriceListItem.get(sourceId);
                if (priceListItem) {
                    itemName = itemName || priceListItem.item;
                    unitPrice = unitPrice || priceListItem.unit_cost || priceListItem.price || 0;
                }
            } else if (sourceType === "project_part") {
                const part = await base44.asServiceRole.entities.Part.get(sourceId);
                if (part) {
                    itemName = itemName || part.category;
                    // Parts don't have unit price, keep user-entered or 0
                }
            }
            // stock_item would be similar if that entity exists
        } catch (err) {
            console.error(`Failed to auto-populate from ${sourceType}:`, err);
        }
    }
    
    return {
        purchase_order_id: purchaseOrderId,
        source_type: sourceType,
        source_id: sourceId,
        part_id: partId,
        price_list_item_id: sourceType === "price_list" ? sourceId : (item.price_list_item_id || null), // Legacy field
        item_name: itemName,
        description: item.description || itemName || '',
        qty_ordered: item.quantity || item.qty || item.qty_ordered || 0,
        unit_cost_ex_tax: unitPrice,
        unit: unit,
        tax_rate_percent: item.tax_rate_percent || 0,
        total_line_ex_tax: (item.quantity || item.qty || 0) * unitPrice,
        notes: item.notes || null
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const {
          action, id, data,
          supplier_id, project_id, delivery_method, delivery_location,
          line_items, status, supplier_name, notes,
          reference, po_number, po_reference, order_reference,
          name, eta, expected_date, attachments, vehicle_id
        } = await req.json();

        // Action: create
        if (action === 'create') {
            if (!supplier_id || !line_items || line_items.length === 0) {
                return Response.json({ error: 'supplier_id and non-empty line_items are required' }, { status: 400 });
            }

            // 🔒 STRIP LEGACY FIELDS - Never allow writes
            // Normalize PO reference from all possible inputs (canonical: po_reference)
            const normalizedPoRef =
                po_reference ??
                data?.po_reference ??
                po_number ??
                data?.po_number ??
                order_reference ??
                data?.order_reference ??
                reference ??
                data?.reference ??
                null;

            // Dev-only guard
            if (po_number || data?.po_number || order_reference || data?.order_reference || reference || data?.reference) {
                console.warn('⚠️ Blocked legacy PO field write attempt on create', {
                    po_number,
                    order_reference,
                    reference,
                    data_fields: { po_number: data?.po_number, order_reference: data?.order_reference, reference: data?.reference }
                });
            }

            // Normalize name
            const normalizedName = name ?? data?.name ?? null;

            // Fetch supplier to ensure supplier_name persistence
            let resolvedSupplierName = supplier_name || null;
            if (!resolvedSupplierName && supplier_id) {
                try {
                    const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
                    resolvedSupplierName = supplier?.name || null;
                } catch (err) {
                    console.error('Failed to fetch supplier for name:', err);
                }
            }

            // Compute expected_date: prefer expected_date, fallback to eta
            const expected_date_to_save = expected_date ?? eta ?? null;

            const poData = {
                supplier_id,
                supplier_name: resolvedSupplierName,
                project_id: project_id || null,
                status: PO_STATUS.DRAFT,
                delivery_method: delivery_method || PO_DELIVERY_METHOD.DELIVERY,
                delivery_location: delivery_location || null,
                notes: notes || null,
                po_reference: normalizedPoRef,
                name: normalizedName,
                created_by: user.email,
                order_date: new Date().toISOString().split('T')[0],
                expected_date: expected_date_to_save,
            };

            let po = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
            
            // If po_reference was not provided, generate from ID and update PO
            if (!po.po_reference) {
                const generatedRef = `PO-${po.id.slice(0, 8)}`;
                po = await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
                    po_reference: generatedRef,
                    po_number: generatedRef,
                    order_reference: generatedRef,
                    reference: generatedRef,
                });
                console.log('[managePurchaseOrder:create] Generated PO Reference:', generatedRef);
            }
            
            console.log('[managePurchaseOrder:create] Created PO:', {
                id: po.id,
                po_reference: po.po_reference,
                supplier_name: po.supplier_name,
                name: po.name
            });

            // Update project activity if PO is linked to a project
            if (po.project_id) {
                await updateProjectActivity(base44, po.project_id, 'PO Created');
            }

            // Create line items with source type support
            for (const item of line_items) {
                const lineData = await buildLineItemData(base44, po.id, item);
                await base44.asServiceRole.entities.PurchaseOrderLine.create(lineData);
            }

            // Link Parts to PO
            await linkPartsToPO(base44, po.id, line_items);

            // Reload PO with line items for response
            const finalPO = await base44.asServiceRole.entities.PurchaseOrder.get(po.id);
            const finalLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: po.id });
            
            finalPO.line_items = finalLines.map(line => ({
                id: line.id,
                source_type: line.source_type || "custom",
                source_id: line.source_id || null,
                part_id: line.part_id || null,
                name: line.item_name || line.description || '',
                quantity: line.qty_ordered || 0,
                unit_price: line.unit_cost_ex_tax || 0,
                unit: line.unit || null,
                notes: line.notes || null,
                price_list_item_id: line.price_list_item_id // Keep for backward compat
            }));

            return Response.json({ success: true, purchaseOrder: finalPO });
        }

        // Action: update
        if (action === 'update') {
            if (!id) {
                return Response.json({ error: 'id is required for update' }, { status: 400 });
            }

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!po) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            // 🔒 STRIP LEGACY FIELDS - Never allow writes (dev guard)
            if (po_number || data?.po_number || order_reference || data?.order_reference || reference || data?.reference) {
                console.warn('⚠️ Blocked legacy PO field write attempt on update', {
                    poId: id,
                    po_number,
                    order_reference,
                    reference,
                    data_fields: { po_number: data?.po_number, order_reference: data?.order_reference, reference: data?.reference }
                });
            }

            // Logging: Received values
            console.log("[managePurchaseOrder:update] Received:", {
                id,
                top_level: { po_reference, po_number, order_reference, reference, name },
                data: { po_reference: data?.po_reference, po_number: data?.po_number, order_reference: data?.order_reference, reference: data?.reference, name: data?.name }
            });

            const updateData = {};
            if (supplier_id !== undefined) {
                updateData.supplier_id = supplier_id;
                // If supplier changed, update supplier_name
                if (supplier_id && !supplier_name) {
                    try {
                        const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
                        updateData.supplier_name = supplier?.name || null;
                    } catch (err) {
                        console.error('Failed to fetch supplier for name on update:', err);
                    }
                }
            }
            if (supplier_name !== undefined) updateData.supplier_name = supplier_name;
            if (project_id !== undefined) updateData.project_id = project_id || null;
            if (delivery_method !== undefined) updateData.delivery_method = delivery_method || null;
            if (delivery_location !== undefined) updateData.delivery_location = delivery_location || null;
            if (notes !== undefined) updateData.notes = notes || null;
            
            // Compute expected_date: prefer expected_date, fallback to eta
            if (expected_date !== undefined || eta !== undefined) {
                updateData.expected_date = expected_date ?? eta ?? null;
            }
            
            if (attachments !== undefined) updateData.attachments = attachments || [];
            
            // --- PERMANENT GUARDRAIL: Normalize references ---
            // Accept both top-level and data payloads
            const incomingPoReference = firstNonEmpty(
                po_reference,
                data?.po_reference,
                po_number,
                data?.po_number,
                order_reference,
                data?.order_reference,
                reference,
                data?.reference
            );
            
            // Only update if a non-empty reference was provided
            if (incomingPoReference) {
                updateData.po_reference = incomingPoReference;
                updateData.po_number = incomingPoReference;
                updateData.order_reference = incomingPoReference;
                updateData.reference = incomingPoReference;
            }

            // --- Normalize Name from all possible inputs (canonical: name) ---
            // Accept both top-level and data payloads
            const incomingName = name ?? data?.name ?? undefined;

            // Only update name if explicitly provided (not undefined)
            if (incomingName !== undefined) {
                if (incomingName === null) {
                    // Explicitly null - allow setting to null
                    updateData.name = null;
                } else if (typeof incomingName === 'string') {
                    const trimmedName = incomingName.trim();
                    // Only update if trimmed value is non-empty
                    if (trimmedName) {
                        updateData.name = trimmedName;
                    }
                    // Empty string after trim = no update (preserve existing)
                }
            }

            // Logging: Final payload
            console.log("[managePurchaseOrder:update] Update payload:", {
                po_reference: updateData.po_reference,
                name: updateData.name
            });

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);

            // Logging: Result after DB update
            console.log("[managePurchaseOrder:update] DB result:", {
              po_reference: updatedPO.po_reference,
              name: updatedPO.name
            });

            // Sync linked parts status/location and references with PO
            await syncPartsWithPurchaseOrderStatus(base44, updatedPO);
            await syncPartReferencesWithPO(base44, updatedPO);

            // Update project activity if PO is linked to a project
            if (updatedPO.project_id) {
                await updateProjectActivity(base44, updatedPO.project_id, 'PO Updated');
            }

            // Update line items if provided
            if (line_items && Array.isArray(line_items)) {
                // Get existing lines to preserve part_id associations
                const existingLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: id });
                const existingPartIdMap = new Map();
                for (const line of existingLines) {
                    if (line.part_id) {
                        existingPartIdMap.set(line.part_id, line.id);
                    }
                }

                // Delete existing lines
                for (const line of existingLines) {
                    await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
                }

                // Create new lines with source type support, preserving part_id
                for (const item of line_items) {
                    // Ensure part_id is preserved if it exists
                    const lineData = await buildLineItemData(base44, id, item);
                    if (item.part_id && !lineData.part_id) {
                        lineData.part_id = item.part_id;
                    }
                    await base44.asServiceRole.entities.PurchaseOrderLine.create(lineData);
                }

                // Link Parts to PO
                await linkPartsToPO(base44, id, line_items);
            }

            // Reload PO to return fresh data with line items
            const finalPO = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            const finalLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: id });
            
            // Attach line_items to the response for frontend consistency
            finalPO.line_items = finalLines.map(line => ({
                id: line.id,
                source_type: line.source_type || "custom",
                source_id: line.source_id || null,
                part_id: line.part_id || null,
                name: line.item_name || line.description || '',
                quantity: line.qty_ordered || 0,
                unit_price: line.unit_cost_ex_tax || 0,
                unit: line.unit || null,
                notes: line.notes || null,
                price_list_item_id: line.price_list_item_id // Keep for backward compat
            }));

            return Response.json({ success: true, purchaseOrder: finalPO });
        }

        // Action: updateStatus
        if (action === 'updateStatus') {
            if (!id || !status) {
                return Response.json({ error: 'id and status are required' }, { status: 400 });
            }

            // Normalize the status first before validation
            const normalizedStatus = normaliseLegacyPoStatus(status);
            const validStatuses = Object.values(PO_STATUS);
            
            console.log('[managePurchaseOrder:updateStatus] Status validation:', {
                received: status,
                normalized: normalizedStatus,
                validStatuses
            });
            
            if (!validStatuses.includes(normalizedStatus)) {
                return Response.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
            }

            const existing = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!existing) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            // 🔒 DEV GUARD: Block any attempt to modify identity fields via updateStatus
            if (po_reference || po_number || reference || order_reference || name || supplier_name || data?.po_reference || data?.po_number || data?.name || data?.supplier_name) {
                console.warn('⚠️ updateStatus attempted to modify identity fields — blocked', {
                    poId: id,
                    blocked: { po_reference, po_number, reference, order_reference, name, supplier_name }
                });
            }

            const oldStatus = existing.status;
            const newStatus = normalizedStatus;

            // Normalize canonical reference once from existing data
            let normalizedRef = resolvePoRef({
                po_reference: existing.po_reference,
            });

            // If still no reference, generate one from ID
            if (!normalizedRef) {
                normalizedRef = `PO-${existing.id.slice(0, 8)}`;
                console.log('[managePurchaseOrder:updateStatus] Generated missing po_reference:', normalizedRef);
            }

            // 🔒 PERMANENT IDENTITY PRESERVATION - Explicit carry-forward
            const updateData = {
                status: newStatus,
                
                // Preserve identity fields explicitly (safety against destructive updates)
                po_reference: normalizedRef,
                po_number: normalizedRef,
                order_reference: normalizedRef,
                reference: normalizedRef,
                
                name: existing.name || null,
                supplier_name: existing.supplier_name || null,
                supplier_id: existing.supplier_id || null,
            };

            // Enforce po_reference constraint: required once status ≠ draft
            if (newStatus !== PO_STATUS.DRAFT && !normalizedRef) {
                return Response.json({ 
                    error: 'po_reference is required when status is not draft' 
                }, { status: 400 });
            }

            // Set timestamps based on status
            if (newStatus === PO_STATUS.ON_ORDER) {
                updateData.sent_at = new Date().toISOString();
            } else if (newStatus === PO_STATUS.IN_LOADING_BAY) {
                updateData.arrived_at = new Date().toISOString();
            }
            
            // Update expected_date if provided (only mutable field allowed)
            if (expected_date !== undefined || eta !== undefined) {
                updateData.expected_date = expected_date ?? eta ?? null;
            }

            console.log('[managePurchaseOrder:updateStatus] Preserving identity:', {
                poId: id,
                po_reference: updateData.po_reference,
                supplier_name: updateData.supplier_name,
                name: updateData.name
            });

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);
            
            console.log('[managePurchaseOrder:updateStatus] Result:', {
                po_reference: updatedPO.po_reference,
                supplier_name: updatedPO.supplier_name,
                name: updatedPO.name
            });

            // Update project activity if PO is linked to a project
            if (updatedPO.project_id) {
                const activityType = newStatus === PO_STATUS.IN_LOADING_BAY ? 'PO Delivered' :
                                   newStatus === PO_STATUS.IN_STORAGE ? 'PO in Storage' :
                                   newStatus === PO_STATUS.IN_VEHICLE ? 'PO in Vehicle' :
                                   'PO Status Updated';
                await updateProjectActivity(base44, updatedPO.project_id, activityType);
            }

            // Sync linked Parts status/location and references
            await syncPartsWithPurchaseOrderStatus(base44, updatedPO, vehicle_id);
            await syncPartReferencesWithPO(base44, updatedPO);

            // Auto-create Logistics Job if conditions are met
            let logisticsJob = null;

            const shouldHaveLogisticsJob =
                !updatedPO.linked_logistics_job_id && // only if no job linked yet
                (
                    // DELIVERY: create job when IN_LOADING_BAY
                    (updatedPO.delivery_method === PO_DELIVERY_METHOD.DELIVERY &&
                     newStatus === PO_STATUS.IN_LOADING_BAY) ||

                    // PICKUP: create job when IN_LOADING_BAY (for pickup, this represents ready at supplier)
                    (updatedPO.delivery_method === PO_DELIVERY_METHOD.PICKUP &&
                     newStatus === PO_STATUS.IN_LOADING_BAY)
                );

            if (shouldHaveLogisticsJob) {
                try {
                    const jobResponse = await base44.asServiceRole.functions.invoke("createLogisticsJobForPO", {
                        purchase_order_id: updatedPO.id,
                        scheduled_date: updatedPO.expected_date || new Date().toISOString().split("T")[0],
                    });

                    if (jobResponse?.data?.success && jobResponse.data?.job) {
                        logisticsJob = jobResponse.data.job;

                        // Update PO with logistics job link if not already set
                        if (!updatedPO.linked_logistics_job_id) {
                            await base44.asServiceRole.entities.PurchaseOrder.update(updatedPO.id, {
                                linked_logistics_job_id: logisticsJob.id,
                            });
                            updatedPO.linked_logistics_job_id = logisticsJob.id;
                        }
                    } else {
                        console.error("Auto logistics job creation failed for PO", updatedPO.id, jobResponse?.data?.error);
                    }
                } catch (error) {
                    console.error("Error auto-creating logistics job for PO", updatedPO.id, error);
                }
            }

            return Response.json({ 
                success: true, 
                purchaseOrder: updatedPO,
                ...(logisticsJob ? { logisticsJob } : {})
            });
        }

        // Action: delete
        if (action === 'delete') {
            if (!id) {
                return Response.json({ error: 'id is required for delete' }, { status: 400 });
            }

            const po = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!po) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            // Only admins can delete non-draft POs
            if (po.status !== PO_STATUS.DRAFT && user.role !== 'admin') {
                return Response.json({ error: 'Only admins can delete non-draft purchase orders' }, { status: 403 });
            }

            // Delete associated parts first
            const linkedParts = await base44.asServiceRole.entities.Part.filter({ purchase_order_id: id });
            for (const part of linkedParts) {
                await base44.asServiceRole.entities.Part.delete(part.id);
            }

            // Delete associated line items
            const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: id });
            for (const line of lines) {
                await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
            }

            // Delete the purchase order
            await base44.asServiceRole.entities.PurchaseOrder.delete(id);

            return Response.json({ success: true });
        }

        // Action: getOrCreateProjectSupplierDraft
        if (action === 'getOrCreateProjectSupplierDraft') {
            if (!project_id || !supplier_id) {
                return Response.json({ 
                    success: false, 
                    error: 'project_id and supplier_id are required' 
                }, { status: 400 });
            }

            // Try to find existing DRAFT PO for this project + supplier
            const existingPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({
                project_id,
                supplier_id,
                status: PO_STATUS.DRAFT
            });

            if (existingPOs.length > 0) {
                const existingPO = existingPOs[0];
                
                // Ensure supplier_name is populated if missing
                if (!existingPO.supplier_name && existingPO.supplier_id) {
                    try {
                        const supplier = await base44.asServiceRole.entities.Supplier.get(existingPO.supplier_id);
                        if (supplier?.name) {
                            await base44.asServiceRole.entities.PurchaseOrder.update(existingPO.id, {
                                supplier_name: supplier.name
                            });
                            existingPO.supplier_name = supplier.name;
                        }
                    } catch (err) {
                        console.error('Failed to fetch supplier for existing PO:', err);
                    }
                }
                
                // Load line items for the response
                const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ 
                    purchase_order_id: existingPO.id 
                });
                
                existingPO.line_items = lines.map(line => ({
                    id: line.id,
                    source_type: line.source_type || "custom",
                    source_id: line.source_id || null,
                    part_id: line.part_id || null,
                    name: line.item_name || line.description || '',
                    quantity: line.qty_ordered || 0,
                    unit_price: line.unit_cost_ex_tax || 0,
                    unit: line.unit || null,
                    notes: line.notes || null,
                    price_list_item_id: line.price_list_item_id
                }));

                return Response.json({
                    success: true,
                    purchaseOrder: existingPO,
                    reused: true
                });
            }

            // Create new DRAFT PO
            // Fetch supplier to ensure supplier_name persistence
            let resolvedSupplierName = supplier_name || null;
            if (!resolvedSupplierName && supplier_id) {
                try {
                    const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
                    resolvedSupplierName = supplier?.name || null;
                } catch (err) {
                    console.error('Failed to fetch supplier for name on create:', err);
                }
            }

            // 🔒 STRIP LEGACY FIELDS - Never allow writes
            const normalizedPoRef =
                po_reference ??
                data?.po_reference ??
                po_number ??
                data?.po_number ??
                order_reference ??
                data?.order_reference ??
                reference ??
                data?.reference ??
                null;

            // Dev-only guard
            if (po_number || data?.po_number || order_reference || data?.order_reference || reference || data?.reference) {
                console.warn('⚠️ Blocked legacy PO field write attempt on getOrCreateProjectSupplierDraft', {
                    po_number,
                    order_reference,
                    reference
                });
            }

            const normalizedName = name ?? data?.name ?? null;

            // Compute expected_date: prefer expected_date, fallback to eta
            const expected_date_to_save = expected_date ?? eta ?? null;

            const poData = {
                supplier_id,
                supplier_name: resolvedSupplierName,
                project_id,
                status: PO_STATUS.DRAFT,
                delivery_method: delivery_method || PO_DELIVERY_METHOD.DELIVERY,
                delivery_location: delivery_location || null,
                notes: notes || null,
                po_reference: normalizedPoRef,
                name: normalizedName,
                created_by: user.email,
                order_date: new Date().toISOString().split('T')[0],
                expected_date: expected_date_to_save,
            };

            let newPO = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
            
            // If po_reference was not provided, generate from ID and update PO
            if (!newPO.po_reference) {
                const generatedRef = `PO-${newPO.id.slice(0, 8)}`;
                newPO = await base44.asServiceRole.entities.PurchaseOrder.update(newPO.id, {
                    po_reference: generatedRef,
                    po_number: generatedRef,
                    order_reference: generatedRef,
                    reference: generatedRef,
                });
                console.log('[managePurchaseOrder:getOrCreateProjectSupplierDraft] Generated PO Reference:', generatedRef);
            }
            
            // Initialize with empty line_items array
            newPO.line_items = [];

            return Response.json({
                success: true,
                purchaseOrder: newPO,
                reused: false
            });
        }

        // LEGACY ACTION - DEPRECATED in favor of updateStatus
        if (action === 'markAsSent') {
            const poId = id;
            if (!poId) return Response.json({ error: 'Missing PO ID' }, { status: 400 });

            // 1. Update PO status (using old schema "sent" vs new "Sent")
            const updateData = {
                status: "sent",
                email_sent_at: new Date().toISOString(),
                ...data // Allow passing other fields if needed
            };
            const po = await base44.asServiceRole.entities.PurchaseOrder.update(poId, updateData);

            // 2. Handle Logistics Job for Stock POs
            // Check if it's a stock PO (no project_id) and has a supplier
            // Note: PurchaseOrder entity doesn't have project_id directly on it usually,
            // but if it were linked to a project it might be via PurchaseOrderLine items having project_id or similar.
            // However, the prompt assumes "Stock POs are not linked to projects".
            // We'll check if there's any indication of a project.
            // For now, we assume all POs are candidates for this logic unless we see a project link.
            // Since standard POs created in SupplierPurchaseOrderModal don't seem to link to project_id, 
            // we treat them as stock POs or general POs that need logistics tracking.
            
            if (po.supplier_id) {
                const supplier = await base44.asServiceRole.entities.Supplier.get(po.supplier_id);
                
                // a) Resolve fulfilment method
                let fulfilment = po.fulfilment_method;
                if (!fulfilment && supplier) {
                    const pref = supplier.fulfilment_preference; // "pickup", "delivery", "mixed"
                    if (pref === "pickup" || pref === "delivery") {
                        fulfilment = pref;
                    }
                }
                if (!fulfilment) fulfilment = "delivery"; // Default

                // b) Determine location
                let locationId = po.delivery_location_id;
                let locationName = po.delivery_location_name;
                if (!locationId) {
                    // Default to Main Warehouse if possible, or try to find it
                    const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({ type: "Warehouse" });
                    if (warehouses.length > 0) {
                        locationId = warehouses[0].id;
                        locationName = warehouses[0].name;
                    }
                }

                // c) Determine date
                const scheduledDate = po.expected_date || po.order_date || new Date().toISOString().split('T')[0];

                // Check existing job
                const existingJobs = await base44.asServiceRole.entities.Job.filter({
                    purchase_order_id: po.id
                });

                const jobTypeName = fulfilment === "pickup" ? "Stock – Supplier Pickup" : "Stock – Supplier Delivery";
                
                let address;
                if (fulfilment === "pickup") {
                    address = supplier.pickup_address || supplier.name;
                } else {
                    // Delivery - use the warehouse/location address
                    const location = locationId ? await base44.asServiceRole.entities.InventoryLocation.get(locationId) : null;
                    address = location?.address || locationName || "Warehouse";
                }

                // Build notes with PO info
                let notes = po.notes || '';

                // Get the actual line items with proper item names
                const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: po.id });
                const priceListItemIds = poLines.map(l => l.price_list_item_id).filter(Boolean);
                const priceListItems = priceListItemIds.length > 0 
                    ? await base44.asServiceRole.entities.PriceListItem.filter({ id: { $in: priceListItemIds } })
                    : [];
                
                const itemMap = {};
                for (const item of priceListItems) {
                    itemMap[item.id] = item.item;
                }

                // Build detailed line items summary
                const itemsSummary = poLines.map(line => {
                    const itemName = itemMap[line.price_list_item_id] || line.description || "Item";
                    const qty = line.qty_ordered || 0;
                    return `${qty}x ${itemName}`;
                }).join(', ');

                const jobData = {
                    purchase_order_id: po.id,
                    project_id: null, // Stock PO
                    job_type: jobTypeName,
                    job_type_name: jobTypeName,
                    status: "Scheduled",
                    location_id: locationId,
                    address: address,
                    address_full: address,
                    scheduled_date: scheduledDate,
                    notes: `PO ${po.po_number || po.id} from ${supplier.name} – ${itemsSummary}${notes ? '\n' + notes : ''}`,
                    overview: `${fulfilment === "pickup" ? "Pickup" : "Delivery"} from ${supplier.name}: ${itemsSummary}`,
                    customer_name: supplier.name,
                    image_urls: po.attachments || []
                };

                if (existingJobs.length > 0) {
                    // Update existing
                    await base44.asServiceRole.entities.Job.update(existingJobs[0].id, jobData);
                } else {
                    // Create new
                    // Find or create JobType if needed
                    let jobTypes = await base44.asServiceRole.entities.JobType.filter({ name: jobTypeName });
                    let jobTypeId = jobTypes.length > 0 ? jobTypes[0].id : null;
                    
                    if (!jobTypeId) {
                         const newJobType = await base44.asServiceRole.entities.JobType.create({
                             name: jobTypeName,
                             description: fulfilment === "pickup" ? "Pickup stock from supplier" : "Receive stock delivery from supplier",
                             color: fulfilment === "pickup" ? "#f59e0b" : "#3b82f6", // Amber or Blue
                             estimated_duration: 1,
                             is_active: true
                         });
                         jobTypeId = newJobType.id;
                    }

                    await base44.asServiceRole.entities.Job.create({
                        ...jobData,
                        job_type_id: jobTypeId
                    });
                }
            }

            return Response.json({ success: true, po });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});