import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * backfillInventorySku - Populate item_sku on InventoryQuantity and StockMovement
 *
 * Uses normalized item_name matching (lowercase, trim, collapse spaces) to find
 * exact matches in PriceListItem. Only accepts if exactly one match exists and
 * the item has a sku.
 *
 * Admin-only. Supports dry-run.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({
        error: 'Forbidden: Admin access required',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }
 
    const { dryRun = true } = await req.json();
    const isDryRun = dryRun === false || dryRun === 'false' ? false : true;

    console.log(`[backfillInventorySku] Starting (dryRun=${isDryRun})`);

    // Build normalized name → PriceListItem map
    const allItems = await base44.asServiceRole.entities.PriceListItem.list();
    const normalizedNameMap = new Map(); // normalized name → [PriceListItem]

    allItems.forEach(item => {
      if (item.item) {
        const normalized = item.item.toLowerCase().trim().replace(/\s+/g, ' ');
        if (!normalizedNameMap.has(normalized)) {
          normalizedNameMap.set(normalized, []);
        }
        normalizedNameMap.get(normalized).push(item);
      }
    });

    let qtyUpdated = 0;
    let qtyUnresolved = 0;
    let movementUpdated = 0;
    let movementUnresolved = 0;
    const needsReview = [];
    const sampleMappings = [];

    // ========================================
    // Step 1: Backfill InventoryQuantity
    // ========================================
    const allQuantities = await base44.asServiceRole.entities.InventoryQuantity.list();

    for (const qty of allQuantities) {
      if (qty.item_sku) {
        // Already has SKU, skip
        continue;
      }

      if (!qty.item_name) {
        // No name to resolve from
        qtyUnresolved++;
        needsReview.push({
          entity: 'InventoryQuantity',
          id: qty.id,
          reason: 'no_item_name'
        });
        continue;
      }

      const normalized = qty.item_name.toLowerCase().trim().replace(/\s+/g, ' ');
      const matches = normalizedNameMap.get(normalized) || [];

      if (matches.length === 0) {
        qtyUnresolved++;
        needsReview.push({
          entity: 'InventoryQuantity',
          id: qty.id,
          item_name: qty.item_name,
          reason: 'no_match'
        });
      } else if (matches.length > 1) {
        qtyUnresolved++;
        needsReview.push({
          entity: 'InventoryQuantity',
          id: qty.id,
          item_name: qty.item_name,
          reason: 'multiple_matches',
          match_count: matches.length
        });
      } else {
        // Exactly one match
        const match = matches[0];
        if (!match.sku) {
          qtyUnresolved++;
          needsReview.push({
            entity: 'InventoryQuantity',
            id: qty.id,
            item_name: qty.item_name,
            reason: 'missing_sku_on_pricelistitem'
          });
        } else {
          // Accept and update
          if (!isDryRun) {
            await base44.asServiceRole.entities.InventoryQuantity.update(qty.id, {
              item_sku: match.sku
            });
          }
          qtyUpdated++;
          if (sampleMappings.length < 5) {
            sampleMappings.push({
              entity: 'InventoryQuantity',
              item_name: qty.item_name,
              matched_sku: match.sku
            });
          }
        }
      }
    }

    // ========================================
    // Step 2: Backfill StockMovement
    // ========================================
    const allMovements = await base44.asServiceRole.entities.StockMovement.list();

    for (const movement of allMovements) {
      if (movement.item_sku) {
        // Already has SKU, skip
        continue;
      }

      if (!movement.item_name) {
        // No name to resolve from
        movementUnresolved++;
        needsReview.push({
          entity: 'StockMovement',
          id: movement.id,
          reason: 'no_item_name'
        });
        continue;
      }

      const normalized = movement.item_name.toLowerCase().trim().replace(/\s+/g, ' ');
      const matches = normalizedNameMap.get(normalized) || [];

      if (matches.length === 0) {
        movementUnresolved++;
        needsReview.push({
          entity: 'StockMovement',
          id: movement.id,
          item_name: movement.item_name,
          reason: 'no_match'
        });
      } else if (matches.length > 1) {
        movementUnresolved++;
        needsReview.push({
          entity: 'StockMovement',
          id: movement.id,
          item_name: movement.item_name,
          reason: 'multiple_matches',
          match_count: matches.length
        });
      } else {
        // Exactly one match
        const match = matches[0];
        if (!match.sku) {
          movementUnresolved++;
          needsReview.push({
            entity: 'StockMovement',
            id: movement.id,
            item_name: movement.item_name,
            reason: 'missing_sku_on_pricelistitem'
          });
        } else {
          // Accept and update
          if (!dryRun) {
            await base44.asServiceRole.entities.StockMovement.update(movement.id, {
              item_sku: match.sku
            });
          }
          movementUpdated++;
          if (sampleMappings.length < 10) {
            sampleMappings.push({
              entity: 'StockMovement',
              item_name: movement.item_name,
              matched_sku: match.sku
            });
          }
        }
      }
    }

    // ========================================
    // Return summary
    // ========================================
    const summary = {
      success: true,
      dryRun: dryRun,
      applied: !dryRun,
      inventory_quantities: {
        [dryRun ? 'would_update' : 'updated']: qtyUpdated,
        unresolved: qtyUnresolved
      },
      stock_movements: {
        [dryRun ? 'would_update' : 'updated']: movementUpdated,
        unresolved: movementUnresolved
      },
      sample_mappings: sampleMappings.slice(0, 10),
      needs_review: needsReview,
      summary: {
        [dryRun ? 'would_backfill' : 'backfilled']: qtyUpdated + movementUpdated,
        unresolved_count: qtyUnresolved + movementUnresolved
      }
    };

    console.log(`[backfillInventorySku] Complete:`, summary);

    return Response.json(summary);

  } catch (error) {
    console.error('[backfillInventorySku] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});