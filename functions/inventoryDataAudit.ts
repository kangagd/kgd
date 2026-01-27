import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all entities in parallel
    const [quantities, locations, priceItems, parts, movements] = await Promise.all([
      base44.entities.InventoryQuantity.list(),
      base44.entities.InventoryLocation.list(),
      base44.entities.PriceListItem.list(),
      base44.entities.Part.list(),
      base44.entities.StockMovement.list(),
    ]);

    // Build lookup maps
    const locMap = new Map(locations.map(l => [l.id, l]));
    const itemMap = new Map(priceItems.map(i => [i.id, i]));
    const partMap = new Map(parts.map(p => [p.id, p]));

    const issues = {
      orphaned_quantities: [],
      items_without_quantities: [],
      parts_without_quantities: [],
      broken_stock_movements: [],
      quantity_reference_mismatches: [],
    };

    // 1. Find orphaned/broken InventoryQuantity records
    quantities.forEach(qty => {
      const issues_for_qty = [];

      if (!qty.item_name || qty.item_name.trim() === '') {
        issues_for_qty.push('missing_item_name');
      }
      if (!qty.location_name || qty.location_name.trim() === '') {
        issues_for_qty.push('missing_location_name');
      }
      if (!itemMap.has(qty.price_list_item_id)) {
        issues_for_qty.push('price_list_item_not_found');
      }
      if (!locMap.has(qty.location_id)) {
        issues_for_qty.push('location_not_found');
      }

      if (issues_for_qty.length > 0) {
        issues.orphaned_quantities.push({
          id: qty.id,
          item_name: qty.item_name || '(blank)',
          location_name: qty.location_name || '(blank)',
          quantity: qty.quantity,
          price_list_item_id: qty.price_list_item_id,
          location_id: qty.location_id,
          issues: issues_for_qty,
          created_date: qty.created_date,
        });
      }
    });

    // 2. Find PriceListItems with track_inventory=true but no InventoryQuantity
    const qtyByItem = new Map();
    quantities.forEach(qty => {
      if (!qtyByItem.has(qty.price_list_item_id)) {
        qtyByItem.set(qty.price_list_item_id, []);
      }
      qtyByItem.get(qty.price_list_item_id).push(qty);
    });

    priceItems
      .filter(i => i.track_inventory === true && i.is_active === true)
      .forEach(item => {
        if (!qtyByItem.has(item.id)) {
          issues.items_without_quantities.push({
            id: item.id,
            item: item.item,
            sku: item.sku,
            category: item.category,
            severity: 'high',
          });
        }
      });

    // 3. Find Parts in stock locations (status = 'in_storage', 'in_vehicle') but no InventoryQuantity
    const qtyByLocationAndItem = new Map();
    quantities.forEach(qty => {
      const key = `${qty.location_id}:${qty.price_list_item_id}`;
      qtyByLocationAndItem.set(key, qty);
    });

    parts
      .filter(p => ['in_storage', 'in_vehicle'].includes(p.status))
      .forEach(part => {
        const priceItem = itemMap.get(part.price_list_item_id);
        if (part.location_id && priceItem) {
          const key = `${part.location_id}:${part.price_list_item_id}`;
          if (!qtyByLocationAndItem.has(key)) {
            issues.parts_without_quantities.push({
              part_id: part.id,
              item_name: part.item_name || priceItem.item,
              sku: priceItem.sku,
              location_id: part.location_id,
              location_name: locMap.get(part.location_id)?.name || '(unknown)',
              part_status: part.status,
              severity: 'high',
            });
          }
        }
      });

    // 4. Find StockMovement records with broken references
    movements.forEach(move => {
      const issues_for_move = [];

      if (!itemMap.has(move.price_list_item_id)) {
        issues_for_move.push('price_list_item_not_found');
      }
      if (!locMap.has(move.location_id)) {
        issues_for_move.push('location_not_found');
      }

      if (issues_for_move.length > 0) {
        issues.broken_stock_movements.push({
          id: move.id,
          price_list_item_id: move.price_list_item_id,
          location_id: move.location_id,
          movement_type: move.movement_type,
          quantity: move.quantity,
          issues: issues_for_move,
          created_date: move.created_date,
        });
      }
    });

    // 5. Mismatch detection: InventoryQuantity totals vs actual Parts on hand
    quantities.forEach(qty => {
      const matchingParts = parts.filter(
        p => p.price_list_item_id === qty.price_list_item_id &&
             p.location_id === qty.location_id &&
             ['in_storage', 'in_vehicle'].includes(p.status)
      );
      
      if (matchingParts.length > 0 && matchingParts.length !== qty.quantity) {
        issues.quantity_reference_mismatches.push({
          qty_id: qty.id,
          item_name: qty.item_name,
          location_name: qty.location_name,
          qty_recorded: qty.quantity,
          parts_found: matchingParts.length,
          part_ids: matchingParts.map(p => p.id),
        });
      }
    });

    return Response.json({
      success: true,
      summary: {
        total_inventory_quantities: quantities.length,
        orphaned_count: issues.orphaned_quantities.length,
        items_without_quantities: issues.items_without_quantities.length,
        parts_without_quantities: issues.parts_without_quantities.length,
        broken_movements: issues.broken_stock_movements.length,
        quantity_mismatches: issues.quantity_reference_mismatches.length,
      },
      issues,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});