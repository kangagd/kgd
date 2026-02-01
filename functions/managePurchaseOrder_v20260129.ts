import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { 
  PO_STATUS, 
  PART_STATUS, 
  PART_LOCATION, 
  PO_DELIVERY_METHOD,
  normaliseLegacyPoStatus, 
  resolvePoRef, 
  mapPoStatusToPartStatus, 
  linkPartsToPO 
} from './shared/index.ts';

console.log("[DEPLOY_SENTINEL] managePurchaseOrder_v20260129 v=2026-01-29");

const VERSION = "2026-01-29";

// DEPLOYMENT CACHE BUSTER: 2026-01-28T12:00:00Z
// Forces platform to pick up latest bytecode instead of serving stale cache

// Helper: Sync Parts with PurchaseOrder status
// CRITICAL: Only syncs parts where primary_purchase_order_id matches (prevents circular references)
async function syncPartsWithPurchaseOrderStatus(base44, purchaseOrder, vehicleId = null) {
    try {
        // Normalize the status first
        const normalizedStatus = normaliseLegacyPoStatus(purchaseOrder.status);
        
        // Fetch Parts where this PO is the PRIMARY (authoritative) PO
        // This prevents overwrites when a part is linked to multiple POs
        const relevantParts = await base44.asServiceRole.entities.Part.filter({ 
            primary_purchase_order_id: purchaseOrder.id 
        });

        if (relevantParts.length === 0) {
            console.log(`[syncParts] No parts with primary_purchase_order_id=${purchaseOrder.id}`);
            return;
        }

        // Determine target part status from PO status
        const targetPartStatus = mapPoStatusToPartStatus(normalizedStatus);

        for (const part of relevantParts) {
            // GUARDRAIL: Validate status transition before applying
            const validation = validatePartStatusTransition(part.status, targetPartStatus);
            if (!validation.valid) {
                console.warn(`[syncParts] Blocked invalid transition for part ${part.id}: ${validation.error}`);
                continue; // Skip this part, continue with others
            }

            const updateData = {
                status: targetPartStatus,
                last_synced_from_po_at: new Date().toISOString(),
                synced_by: 'system:managePurchaseOrder_v20260129'
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

                case PO_STATUS.AT_SUPPLIER:
                    // At supplier location - ready for pickup
                    updateData.location = PART_LOCATION.SUPPLIER;
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
            console.log(`[syncParts] Synced part ${part.id} from primary PO ${purchaseOrder.id} to status ${targetPartStatus}`);
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

function validatePartStatusTransition(oldStatus, newStatus) {
    return { valid: true };
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
          name, eta, expected_date, attachments, vehicle_id,
          expected_write_version, write_source
        } = await req.json();

        // Action: create (fully functional)
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
                console.log('[managePurchaseOrder_v20260129] action=create Generated PO Reference:', generatedRef);
            }
            
            console.log('[managePurchaseOrder_v20260129] action=create Created PO:', {
                id: po.id,
                po_reference: po.po_reference,
                supplier_name: po.supplier_name,
                name: po.name
            });

            // Update project last_activity_at if linked
            if (po.project_id) {
                try {
                    await base44.asServiceRole.entities.Project.update(po.project_id, {
                        last_activity_at: new Date().toISOString(),
                        last_activity_type: 'PO Created'
                    });
                } catch (err) {
                    console.error('Error updating project activity:', err);
                }
            }

            // Create line items with source type support
            for (const item of line_items) {
                const lineData = await buildLineItemData(base44, po.id, item);
                lineData.status = item.status ?? "draft";
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

        // Action: updateStatus
        if (action === 'updateStatus') {
            if (!id || !status) {
                return Response.json({ error: 'id and status are required' }, { status: 400 });
            }

            // ✅ CANONICAL STATUS LIST - Single source of truth
            const validStatuses = [
                "draft",
                "sent",
                "on_order",
                "in_transit",
                "in_loading_bay",
                "at_supplier",
                "in_storage",
                "in_vehicle",
                "installed",
                "cancelled"
            ];

            // 🔒 REGRESSION CHECK: Ensure this version is configured correctly
            if (validStatuses.length < 6) {
                return Response.json({
                    error: 'Server misconfiguration: status ruleset incomplete',
                    error_code: 'misconfigured_status_ruleset',
                    allowed_count: validStatuses.length
                }, { status: 500 });
            }

            console.log('[managePurchaseOrder_v20260129] updateStatus version=2026-01-29 allowed=' + validStatuses.join(',') + ' po=' + id);

            // Normalize the status first before validation
            const normalizedStatus = normaliseLegacyPoStatus(status);
            console.log('[managePurchaseOrder_v20260129] Normalized status:', { input: status, normalized: normalizedStatus });

            if (!validStatuses.includes(normalizedStatus)) {
                return Response.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
            }

            const existing = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!existing) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            // 🔒 VALIDATION: Enforce po_reference before allowing non-draft status
            if (normalizedStatus !== PO_STATUS.DRAFT) {
                if (!existing.po_reference || existing.po_reference.trim() === "") {
                    return Response.json({ 
                        success: false,
                        error: 'PO Reference is required before changing status. Please save the PO with a reference first.',
                        error_code: 'po_reference_required'
                    }, { status: 400 });
                }
            }

            const oldStatus = existing.status;
            const newStatus = normalizedStatus;

            // Normalize canonical reference once from existing data
            let normalizedRef = existing.po_reference;

            // If still no reference, generate one from ID
            if (!normalizedRef) {
                normalizedRef = `PO-${existing.id.slice(0, 8)}`;
                console.log('[managePurchaseOrder_v20260129] action=updateStatus Generated missing po_reference:', normalizedRef);
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
                
                // Increment write_version to detect future stale writes
                write_version: (existing.write_version || 1) + 1
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

            // STEP 1: Check if we need to create a logistics job BEFORE updating status
            // This ensures job creation succeeds before we commit the status change
            let logisticsJob = null;
            
            const shouldHaveLogisticsJob =
                !existing.linked_logistics_job_id && // only if no job linked yet
                (
                    // DELIVERY: create job when IN_LOADING_BAY
                    (existing.delivery_method === PO_DELIVERY_METHOD.DELIVERY &&
                     newStatus === PO_STATUS.IN_LOADING_BAY) ||

                    // PICKUP: create job when AT_SUPPLIER (ready for pickup at supplier location)
                    (existing.delivery_method === PO_DELIVERY_METHOD.PICKUP &&
                     newStatus === PO_STATUS.AT_SUPPLIER)
                );

            if (shouldHaveLogisticsJob) {
                try {
                    // Invoke the createLogisticsJobForPO_v20260129 function FIRST (validate it succeeds)
                    const jobResponse = await base44.asServiceRole.functions.invoke("createLogisticsJobForPO_v20260129", {
                        purchase_order_id: existing.id,
                        scheduled_date: existing.expected_date || new Date().toISOString().split("T")[0],
                    });

                    if (!jobResponse?.data?.success || !jobResponse.data?.job) {
                        // Job creation failed - return error early WITHOUT updating PO status
                        console.error("Auto logistics job creation failed for PO", existing.id, jobResponse?.data?.error);
                        return Response.json({ 
                            error: `Failed to create logistics job: ${jobResponse?.data?.error || 'Unknown error'}` 
                        }, { status: 500 });
                    }
                    logisticsJob = jobResponse.data.job;
                    console.log(`[managePurchaseOrder_v20260129] action=updateStatus Created logistics job ${logisticsJob.id} before status update`);
                } catch (error) {
                    // Job creation failed - return error early WITHOUT updating PO status
                    console.error("Error auto-creating logistics job for PO", existing.id, error);
                    return Response.json({ 
                        error: `Failed to create logistics job: ${error.message}` 
                    }, { status: 500 });
                }
            }

            // STEP 2: Now update PO status (job creation succeeded)
            console.log('[managePurchaseOrder_v20260129] action=updateStatus Preserving identity:', {
                poId: id,
                po_reference: updateData.po_reference,
                supplier_name: updateData.supplier_name,
                name: updateData.name
            });

            const updatedPO = await base44.asServiceRole.entities.PurchaseOrder.update(id, updateData);
            
            console.log('[managePurchaseOrder_v20260129] action=updateStatus Result:', {
                po_reference: updatedPO.po_reference,
                supplier_name: updatedPO.supplier_name,
                name: updatedPO.name
            });

            // STEP 3: Update project last_activity_at if linked
            if (updatedPO.project_id) {
                try {
                    const activityType = newStatus === PO_STATUS.IN_LOADING_BAY ? 'PO Delivered' :
                                       newStatus === PO_STATUS.IN_STORAGE ? 'PO in Storage' :
                                       newStatus === PO_STATUS.IN_VEHICLE ? 'PO in Vehicle' :
                                       'PO Status Updated';
                    await base44.asServiceRole.entities.Project.update(updatedPO.project_id, {
                        last_activity_at: new Date().toISOString(),
                        last_activity_type: activityType
                    });
                } catch (err) {
                    console.error('Error updating project activity:', err);
                }
            }

            // STEP 4: Sync linked Parts status/location and references
            await syncPartsWithPurchaseOrderStatus(base44, updatedPO, vehicle_id);
            await syncPartReferencesWithPO(base44, updatedPO);

            // STEP 5: Link created job to PO if one was created
            if (logisticsJob && !updatedPO.linked_logistics_job_id) {
                await base44.asServiceRole.entities.PurchaseOrder.update(updatedPO.id, {
                    linked_logistics_job_id: logisticsJob.id,
                });
                updatedPO.linked_logistics_job_id = logisticsJob.id;
                console.log(`[managePurchaseOrder_v20260129] action=updateStatus Linked logistics job ${logisticsJob.id} to PO`);
            }

            return Response.json({ 
                success: true, 
                purchaseOrder: updatedPO,
                version: VERSION,
                ...(logisticsJob ? { logisticsJob } : {})
            });
        }

        // Action: delete
        if (action === 'delete') {
            if (!id) {
                return Response.json({ error: 'id is required' }, { status: 400 });
            }

            const existing = await base44.asServiceRole.entities.PurchaseOrder.get(id);
            if (!existing) {
                return Response.json({ error: 'Purchase Order not found' }, { status: 404 });
            }

            // Delete associated line items first
            const lines = await base44.asServiceRole.entities.PurchaseOrderLine.filter({ purchase_order_id: id });
            for (const line of lines) {
                await base44.asServiceRole.entities.PurchaseOrderLine.delete(line.id);
            }

            // Delete the PO
            await base44.asServiceRole.entities.PurchaseOrder.delete(id);

            console.log('[managePurchaseOrder_v20260129] action=delete Deleted PO:', id);

            return Response.json({ success: true });
        }

        // Action: getOrCreateProjectSupplierDraft
        if (action === 'getOrCreateProjectSupplierDraft') {
            const { project_id, supplier_id } = await req.json();
            
            if (!project_id || !supplier_id) {
                return Response.json({ error: 'project_id and supplier_id are required' }, { status: 400 });
            }

            // Try to find existing draft PO for this project + supplier
            const existingDrafts = await base44.asServiceRole.entities.PurchaseOrder.filter({
                project_id,
                supplier_id,
                status: PO_STATUS.DRAFT
            });

            if (existingDrafts.length > 0) {
                return Response.json({ success: true, purchaseOrder: existingDrafts[0] });
            }

            // Create new draft PO
            const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
            const poData = {
                supplier_id,
                supplier_name: supplier?.name || null,
                project_id,
                status: PO_STATUS.DRAFT,
                delivery_method: PO_DELIVERY_METHOD.DELIVERY,
                created_by: user.email,
                order_date: new Date().toISOString().split('T')[0],
            };

            const newPO = await base44.asServiceRole.entities.PurchaseOrder.create(poData);
            
            // Generate reference if missing
            if (!newPO.po_reference) {
                const generatedRef = `PO-${newPO.id.slice(0, 8)}`;
                const updated = await base44.asServiceRole.entities.PurchaseOrder.update(newPO.id, {
                    po_reference: generatedRef,
                    po_number: generatedRef,
                    order_reference: generatedRef,
                    reference: generatedRef,
                });
                return Response.json({ success: true, purchaseOrder: updated });
            }

            return Response.json({ success: true, purchaseOrder: newPO });
        }

        // Supported actions for v20260129
        return Response.json({ 
            error: 'Invalid action. Supported in v20260129: create, updateStatus, delete, getOrCreateProjectSupplierDraft' 
        }, { status: 400 });

    } catch (error) {
        console.error('[managePurchaseOrder_v20260129] Exception:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});