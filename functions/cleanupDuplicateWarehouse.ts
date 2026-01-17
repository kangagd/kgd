import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { canonical_warehouse_id, legacy_warehouse_id } = payload;

    if (!canonical_warehouse_id || !legacy_warehouse_id) {
      return Response.json({ 
        error: 'Missing required parameters: canonical_warehouse_id, legacy_warehouse_id' 
      }, { status: 400 });
    }

    // Step 1: Fetch and validate both locations exist
    let canonicalLoc, legacyLoc;
    try {
      canonicalLoc = await base44.asServiceRole.entities.InventoryLocation.get(canonical_warehouse_id);
      legacyLoc = await base44.asServiceRole.entities.InventoryLocation.get(legacy_warehouse_id);
    } catch (err) {
      return Response.json({ error: 'One or both locations not found' }, { status: 404 });
    }

    if (canonicalLoc.type !== 'warehouse' || legacyLoc.type !== 'warehouse') {
      return Response.json({ error: 'Both locations must be type "warehouse"' }, { status: 400 });
    }

    // Step 1.5: Retire the legacy warehouse location
    await base44.asServiceRole.entities.InventoryLocation.update(legacy_warehouse_id, {
      name: '(LEGACY - DUPLICATE) Warehouse — DO NOT USE',
      is_active: false
    });

    // Step 2: Query InventoryQuantity rows on legacy location
    const inventoryQuantities = await base44.asServiceRole.entities.InventoryQuantity.filter({
      location_id: legacy_warehouse_id
    });

    const cleanupResults = {
      deleted: [],
      patched: [],
      skipped: []
    };

    // Step 3: Clean up placeholder rows
    for (const row of inventoryQuantities) {
      const isPlaceholder = 
        row.quantity === 0 && 
        (!row.item_name || row.item_name.trim() === '') && 
        (!row.location_name || row.location_name.trim() === '');

      if (isPlaceholder) {
        // Try to delete first
        try {
          await base44.asServiceRole.entities.InventoryQuantity.delete(row.id);
          cleanupResults.deleted.push({
            id: row.id,
            price_list_item_id: row.price_list_item_id
          });
        } catch (deleteErr) {
          // If delete fails due to RLS, patch instead
          try {
            let itemName = row.item_name;
            if (!itemName || itemName.trim() === '') {
              try {
                const priceListItem = await base44.asServiceRole.entities.PriceListItem.get(row.price_list_item_id);
                itemName = priceListItem.item || 'Unknown Item';
              } catch {
                itemName = 'Unknown Item';
              }
            }

            await base44.asServiceRole.entities.InventoryQuantity.update(row.id, {
              location_name: '(LEGACY - DUPLICATE) Warehouse — DO NOT USE',
              item_name: itemName
            });
            cleanupResults.patched.push({
              id: row.id,
              price_list_item_id: row.price_list_item_id,
              reason: 'Delete failed by RLS, patched instead'
            });
          } catch (patchErr) {
            cleanupResults.skipped.push({
              id: row.id,
              reason: `Both delete and patch failed: ${patchErr.message}`
            });
          }
        }
      } else {
        // Non-placeholder, leave it
        cleanupResults.skipped.push({
          id: row.id,
          reason: 'Not a placeholder (has meaningful data)'
        });
      }
    }

    return Response.json({
      success: true,
      message: 'Duplicate warehouse cleanup completed',
      canonical_warehouse: {
        id: canonicalLoc.id,
        name: canonicalLoc.name,
        status: 'ACTIVE (canonical)'
      },
      legacy_warehouse: {
        id: legacyLoc.id,
        name: '(LEGACY - DUPLICATE) Warehouse — DO NOT USE',
        status: 'RETIRED (is_active=false)'
      },
      cleanup_results: cleanupResults,
      summary: {
        total_inventory_quantity_rows: inventoryQuantities.length,
        deleted_placeholders: cleanupResults.deleted.length,
        patched_placeholders: cleanupResults.patched.length,
        skipped_meaningful_rows: cleanupResults.skipped.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});