import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin-only function
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const blockingIssues = [];
    const warnings = [];
    const summary = {
      locations_ok: true,
      catalog_ok: true,
      legacy_safe: true
    };

    // ========================================
    // 1. Location Integrity (HARD GATE)
    // ========================================
    const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
    
    // Check for required core locations
    const requiredCodes = ['WAREHOUSE_MAIN', 'LOADING_BAY', 'CONSUMED'];
    const locationsByCode = {};
    const duplicateCodes = new Set();
    
    for (const loc of allLocations) {
      if (!loc.location_code) continue;
      
      if (locationsByCode[loc.location_code]) {
        duplicateCodes.add(loc.location_code);
        blockingIssues.push(`Duplicate location_code detected: ${loc.location_code} (${loc.name})`);
      } else {
        locationsByCode[loc.location_code] = loc;
      }
    }
    
    // Verify each required location exists and is active
    for (const code of requiredCodes) {
      const loc = locationsByCode[code];
      if (!loc) {
        blockingIssues.push(`Missing required location: ${code}`);
        summary.locations_ok = false;
      } else if (loc.is_active !== true) {
        blockingIssues.push(`Required location ${code} is not active`);
        summary.locations_ok = false;
      }
    }
    
    // Verify all vehicle locations
    const vehicleLocations = allLocations.filter(loc => loc.type === 'vehicle');
    for (const vLoc of vehicleLocations) {
      if (vLoc.is_active !== true) {
        blockingIssues.push(`Vehicle location ${vLoc.name} (${vLoc.id}) is inactive`);
        summary.locations_ok = false;
      }
      if (!vLoc.location_code) {
        blockingIssues.push(`Vehicle location ${vLoc.name} (${vLoc.id}) has no location_code`);
        summary.locations_ok = false;
      }
    }

    // ========================================
    // 2. Catalog Item Resolvability
    // ========================================
    const allCatalogItems = await base44.asServiceRole.entities.PriceListItem.list();
    
    const catalogCodeMap = {};
    const duplicateCatalogCodes = new Set();
    const inactiveItems = [];
    
    for (const item of allCatalogItems) {
      // Check for catalog_item_code uniqueness
      if (!item.catalog_item_code) {
        warnings.push(`PriceListItem ${item.item} (${item.id}) has no catalog_item_code`);
      } else {
        if (catalogCodeMap[item.catalog_item_code]) {
          duplicateCatalogCodes.add(item.catalog_item_code);
          blockingIssues.push(`Duplicate catalog_item_code: ${item.catalog_item_code} (${item.item})`);
          summary.catalog_ok = false;
        } else {
          catalogCodeMap[item.catalog_item_code] = item;
        }
      }
      
      // Track inactive items (just warning)
      if (item.is_active !== true) {
        inactiveItems.push({
          id: item.id,
          name: item.item,
          catalog_item_code: item.catalog_item_code
        });
      }
    }
    
    if (inactiveItems.length > 0) {
      warnings.push(`${inactiveItems.length} inactive catalog items found (may cause reference issues if used in Parts V2)`);
    }

    // ========================================
    // 3. Existing Seed Collision Scan
    // ========================================
    const existingSeeds = await base44.asServiceRole.entities.StockMovement.filter({
      source_type: 'initial_seed'
    });
    
    if (existingSeeds.length > 0) {
      warnings.push(`${existingSeeds.length} existing seed movements found - CSV import may create duplicates`);
      
      // Group by catalog_item + location
      const seedSummary = {};
      for (const seed of existingSeeds) {
        const key = `${seed.catalog_item_id}__${seed.to_location_id}`;
        if (!seedSummary[key]) {
          seedSummary[key] = {
            catalog_item_id: seed.catalog_item_id,
            to_location_id: seed.to_location_id,
            count: 0,
            total_qty: 0
          };
        }
        seedSummary[key].count++;
        seedSummary[key].total_qty += (seed.quantity || 0);
      }
      
      warnings.push(`Existing seeds grouped: ${Object.keys(seedSummary).length} unique catalog_item x location combinations`);
    }

    // ========================================
    // 4. Legacy Stock Writers Safety Check
    // ========================================
    
    // Check if any InventoryQuantity records exist (should be derived only)
    const inventoryQtyRecords = await base44.asServiceRole.entities.InventoryQuantity.list();
    if (inventoryQtyRecords.length > 0) {
      warnings.push(`${inventoryQtyRecords.length} InventoryQuantity records exist (should be derived from StockMovement only)`);
    }
    
    // Check for legacy VehicleStock records (should be migrated)
    try {
      const legacyVehicleStock = await base44.asServiceRole.entities.VehicleStock.list();
      if (legacyVehicleStock.length > 0) {
        warnings.push(`${legacyVehicleStock.length} legacy VehicleStock records exist (V1 data should be migrated to V2)`);
      }
    } catch (error) {
      // VehicleStock entity might not exist - that's fine
    }
    
    // Check for PriceListItem.stock_level usage (should be derived)
    const itemsWithStockLevel = allCatalogItems.filter(item => 
      item.stock_level != null && item.stock_level !== 0
    );
    if (itemsWithStockLevel.length > 0) {
      warnings.push(`${itemsWithStockLevel.length} PriceListItems have non-zero stock_level (should be derived from V2 only)`);
      summary.legacy_safe = false;
    }

    // ========================================
    // 5. Final Result
    // ========================================
    const readyToSeed = blockingIssues.length === 0;
    
    return Response.json({
      ready_to_seed: readyToSeed,
      blocking_issues: blockingIssues,
      warnings: warnings,
      summary: summary,
      details: {
        total_locations: allLocations.length,
        active_locations: allLocations.filter(l => l.is_active).length,
        vehicle_locations: vehicleLocations.length,
        total_catalog_items: allCatalogItems.length,
        active_catalog_items: allCatalogItems.filter(i => i.is_active).length,
        items_with_catalog_code: allCatalogItems.filter(i => i.catalog_item_code).length,
        existing_seed_movements: existingSeeds.length,
        inventory_qty_records: inventoryQtyRecords.length,
        items_with_legacy_stock: itemsWithStockLevel.length
      }
    });

  } catch (error) {
    console.error('Pre-seed check error:', error);
    return Response.json({ 
      error: error.message,
      ready_to_seed: false,
      blocking_issues: [`System error: ${error.message}`],
      warnings: [],
      summary: {
        locations_ok: false,
        catalog_ok: false,
        legacy_safe: false
      }
    }, { status: 500 });
  }
});