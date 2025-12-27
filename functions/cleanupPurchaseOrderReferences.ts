import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * One-time cleanup/migration for Purchase Order references
 * Backfills and syncs all PO and Part records to use canonical po_reference
 * 
 * Admin only - Run once after deployment
 */

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

function firstNonEmpty(...values) {
  for (const val of values) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

function getPartStatusFromPoStatus(poStatus) {
  const normalized = (poStatus || '').toLowerCase().trim();
  
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
      return PART_STATUS.CANCELLED;
    
    default:
      return PART_STATUS.PENDING;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Authenticate and authorize (admin only)
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized - Admin only' 
      }, { status: 403 });
    }

    console.log('[Cleanup] Starting PO reference cleanup...');

    // 2. Fetch all Purchase Orders
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list();
    console.log(`[Cleanup] Found ${allPOs.length} Purchase Orders`);

    // 3. Fetch all Parts
    const allParts = await base44.asServiceRole.entities.Part.list();
    console.log(`[Cleanup] Found ${allParts.length} Parts`);

    const summary = {
      posScanned: allPOs.length,
      posUpdated: 0,
      posWithEmptyReferences: 0,
      posWithErrors: [],
      partsScanned: allParts.length,
      partsUpdated: 0,
      partsWithErrors: [],
    };

    const BATCH_SIZE = 50;

    // 4. Process POs in batches
    for (let i = 0; i < allPOs.length; i += BATCH_SIZE) {
      const batch = allPOs.slice(i, i + BATCH_SIZE);
      console.log(`[Cleanup] Processing PO batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allPOs.length / BATCH_SIZE)}`);

      for (const po of batch) {
        try {
          // Step 1: Compute canonical reference
          const canonical = firstNonEmpty(
            po.po_reference,
            po.po_number,
            po.order_reference,
            po.reference
          );

          if (!canonical) {
            summary.posWithEmptyReferences++;
            console.log(`[Cleanup] PO ${po.id} has no reference - leaving empty`);
            continue;
          }

          // Step 2: Update PO with canonical reference and mirror to legacy fields
          const updates = {
            po_reference: canonical,
            po_number: canonical,
            order_reference: canonical,
            reference: canonical,
          };

          // Step 3: Clear legacy line_items if present
          if (po.line_items) {
            updates.line_items = null;
          }

          await base44.asServiceRole.entities.PurchaseOrder.update(po.id, updates);
          summary.posUpdated++;
          console.log(`[Cleanup] Updated PO ${po.id} with reference: ${canonical}`);

          // Step 4: Update linked Parts
          const linkedParts = allParts.filter(p => p.purchase_order_id === po.id);
          
          for (const part of linkedParts) {
            try {
              const partUpdates = {
                po_number: canonical,
                order_reference: canonical,
              };

              // Set supplier info if missing
              if (!part.supplier_id && po.supplier_id) {
                partUpdates.supplier_id = po.supplier_id;
              }
              if (!part.supplier_name && po.supplier_name) {
                partUpdates.supplier_name = po.supplier_name;
              }

              // Step 5: Apply part status rules
              const expectedPartStatus = getPartStatusFromPoStatus(po.status);
              
              // Only update status if:
              // - PO is Draft (force to Pending)
              // - Part status doesn't match expected (bring in sync)
              // - Don't downgrade if part is further along (except for Draft case)
              if (po.status === PO_STATUS.DRAFT) {
                partUpdates.status = PART_STATUS.PENDING;
              } else if (part.status !== expectedPartStatus) {
                // Only update if part isn't manually progressed beyond PO
                const partStatusOrder = [
                  PART_STATUS.PENDING,
                  PART_STATUS.ON_ORDER,
                  PART_STATUS.IN_TRANSIT,
                  PART_STATUS.IN_LOADING_BAY,
                  PART_STATUS.IN_STORAGE,
                  PART_STATUS.IN_VEHICLE,
                  PART_STATUS.INSTALLED,
                ];
                const currentIdx = partStatusOrder.indexOf(part.status);
                const expectedIdx = partStatusOrder.indexOf(expectedPartStatus);
                
                // Update if expected is further along or if current status is not in the progression
                if (expectedIdx > currentIdx || currentIdx === -1) {
                  partUpdates.status = expectedPartStatus;
                }
              }

              await base44.asServiceRole.entities.Part.update(part.id, partUpdates);
              summary.partsUpdated++;
              console.log(`[Cleanup] Updated Part ${part.id} for PO ${canonical}`);
            } catch (partError) {
              console.error(`[Cleanup] Error updating Part ${part.id}:`, partError);
              summary.partsWithErrors.push({
                partId: part.id,
                error: partError.message,
              });
            }
          }

        } catch (poError) {
          console.error(`[Cleanup] Error updating PO ${po.id}:`, poError);
          summary.posWithErrors.push({
            poId: po.id,
            error: poError.message,
          });
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < allPOs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('[Cleanup] Cleanup complete!');
    console.log(`[Cleanup] Summary:`, summary);

    return Response.json({
      success: true,
      message: 'Purchase Order reference cleanup completed',
      summary,
    });

  } catch (error) {
    console.error('[Cleanup] Fatal error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});