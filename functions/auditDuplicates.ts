import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalize string for comparison
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ===== AUDIT PRICE LIST ITEMS =====
    const allItems = await base44.asServiceRole.entities.PriceListItem.list();

    // Group by SKU
    const skuMap = new Map();
    const itemsByName = new Map();

    for (const item of allItems) {
      // Group by SKU
      if (item.sku) {
        const key = item.sku.toLowerCase().trim();
        if (!skuMap.has(key)) {
          skuMap.set(key, []);
        }
        skuMap.get(key).push(item);
      }

      // Group by normalized name
      const nameKey = normalize(item.item);
      if (nameKey) {
        if (!itemsByName.has(nameKey)) {
          itemsByName.set(nameKey, []);
        }
        itemsByName.get(nameKey).push(item);
      }
    }

    const priceListDuplicates = {
      bySku: [],
      byNormalizedName: [],
    };

    // Find SKU duplicates
    for (const [sku, items] of skuMap.entries()) {
      if (items.length > 1) {
        priceListDuplicates.bySku.push({
          sku,
          count: items.length,
          ids: items.map((i) => i.id),
          items: items.map((i) => ({ id: i.id, name: i.item, is_active: i.is_active })),
        });
      }
    }

    // Find name duplicates
    for (const [key, items] of itemsByName.entries()) {
      if (items.length > 1) {
        priceListDuplicates.byNormalizedName.push({
          normalizedName: key,
          count: items.length,
          ids: items.map((i) => i.id),
          items: items.map((i) => ({ id: i.id, name: i.item, is_active: i.is_active })),
        });
      }
    }

    // ===== AUDIT INVENTORY LOCATIONS =====
    const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();

    const inventoryLocationDuplicates = {
      multipleWarehousesActive: [],
      vehicleLocationDuplicates: [],
      nameTypeDuplicates: [],
    };

    // Check for multiple active warehouses
    const activeWarehouses = allLocations.filter(
      (loc) => normalize(loc.type) === 'warehouse' && loc.is_active !== false
    );
    if (activeWarehouses.length > 1) {
      inventoryLocationDuplicates.multipleWarehousesActive = activeWarehouses.map((loc) => ({
        id: loc.id,
        name: loc.name,
        is_active: loc.is_active,
      }));
    }

    // Group vehicle locations by vehicle_id
    const vehicleMap = new Map();
    for (const loc of allLocations) {
      if (normalize(loc.type) === 'vehicle' && loc.vehicle_id) {
        const key = loc.vehicle_id;
        if (!vehicleMap.has(key)) {
          vehicleMap.set(key, []);
        }
        vehicleMap.get(key).push(loc);
      }
    }

    for (const [vehicleId, locs] of vehicleMap.entries()) {
      if (locs.length > 1) {
        inventoryLocationDuplicates.vehicleLocationDuplicates.push({
          vehicle_id: vehicleId,
          count: locs.length,
          location_ids: locs.map((l) => l.id),
          location_names: locs.map((l) => l.name),
        });
      }
    }

    // Group by name + type
    const nameTypeMap = new Map();
    for (const loc of allLocations) {
      const typeKey = normalize(loc.type);
      const nameKey = normalize(loc.name);
      const compositeKey = `${typeKey}|${nameKey}`;

      if (!nameTypeMap.has(compositeKey)) {
        nameTypeMap.set(compositeKey, []);
      }
      nameTypeMap.get(compositeKey).push(loc);
    }

    for (const [key, locs] of nameTypeMap.entries()) {
      if (locs.length > 1) {
        const [typeKey, nameKey] = key.split('|');
        inventoryLocationDuplicates.nameTypeDuplicates.push({
          type: typeKey,
          name: nameKey,
          count: locs.length,
          location_ids: locs.map((l) => l.id),
          locations: locs.map((l) => ({
            id: l.id,
            name: l.name,
            is_active: l.is_active,
          })),
        });
      }
    }

    // Calculate summary
    const summary = {
      totalPriceListItems: allItems.length,
      priceListSkuDuplicates: priceListDuplicates.bySku.length,
      priceListNameDuplicates: priceListDuplicates.byNormalizedName.length,
      totalLocations: allLocations.length,
      multipleActiveWarehouses: inventoryLocationDuplicates.multipleWarehousesActive.length > 0 ? 1 : 0,
      vehicleLocationDuplicates: inventoryLocationDuplicates.vehicleLocationDuplicates.length,
      nameTypeDuplicates: inventoryLocationDuplicates.nameTypeDuplicates.length,
    };

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      priceListDuplicates,
      inventoryLocationDuplicates,
    });
  } catch (error) {
    console.error('Audit duplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});