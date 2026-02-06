import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill cached catalog_item_name and catalog_item_code from PriceListItem
 * for all V2 entities that reference catalog_item_id
 * 
 * Entities covered:
 * - ProjectRequirementLine
 * - StockAllocation
 * - StockConsumption
 * - StockMovement
 * - ReceiptLine
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin-only function
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = true } = await req.json();

    const results = {
      dry_run,
      entities_processed: {},
      total_updated: 0,
      total_skipped: 0,
      errors: []
    };

    // Fetch all PriceListItems for mapping
    const allCatalogItems = await base44.asServiceRole.entities.PriceListItem.list();
    const catalogMap = {};
    for (const item of allCatalogItems) {
      catalogMap[item.id] = item;
    }

    // Entity processing configurations
    const entityConfigs = [
      { name: 'ProjectRequirementLine', idField: 'catalog_item_id' },
      { name: 'StockAllocation', idField: 'catalog_item_id' },
      { name: 'StockConsumption', idField: 'catalog_item_id' },
      { name: 'StockMovement', idField: 'catalog_item_id' },
      { name: 'ReceiptLine', idField: 'catalog_item_id' }
    ];

    for (const config of entityConfigs) {
      const entityName = config.name;
      const idField = config.idField;
      
      try {
        const records = await base44.asServiceRole.entities[entityName].list();
        
        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (const record of records) {
          const catalogItemId = record[idField];
          
          // Skip if no catalog item reference
          if (!catalogItemId) {
            skipped++;
            continue;
          }

          // Check if needs update (missing or placeholder name/code)
          const needsNameUpdate = !record.catalog_item_name || 
                                   record.catalog_item_name === 'Part' || 
                                   record.catalog_item_name.trim() === '';
          const needsCodeUpdate = !record.catalog_item_code || 
                                   record.catalog_item_code.trim() === '';

          if (!needsNameUpdate && !needsCodeUpdate) {
            skipped++;
            continue;
          }

          // Lookup catalog item
          const catalogItem = catalogMap[catalogItemId];
          if (!catalogItem) {
            errors.push(`${entityName} ${record.id}: catalog_item_id ${catalogItemId} not found`);
            skipped++;
            continue;
          }

          // Prepare update data
          const updateData = {};
          if (needsNameUpdate && catalogItem.item) {
            updateData.catalog_item_name = catalogItem.item;
          }
          if (needsCodeUpdate && catalogItem.sku) {
            updateData.catalog_item_code = catalogItem.sku;
          }

          // Skip if nothing to update (catalog item also missing data)
          if (Object.keys(updateData).length === 0) {
            skipped++;
            continue;
          }

          // Apply update
          if (!dry_run) {
            try {
              await base44.asServiceRole.entities[entityName].update(record.id, updateData);
              updated++;
            } catch (error) {
              errors.push(`${entityName} ${record.id}: update failed - ${error.message}`);
              skipped++;
            }
          } else {
            // Dry run: just count what would be updated
            updated++;
          }
        }

        results.entities_processed[entityName] = {
          total_records: records.length,
          updated,
          skipped,
          errors
        };
        results.total_updated += updated;
        results.total_skipped += skipped;
        if (errors.length > 0) {
          results.errors.push(...errors);
        }

      } catch (error) {
        results.errors.push(`${entityName}: failed to process - ${error.message}`);
        results.entities_processed[entityName] = {
          error: error.message
        };
      }
    }

    return Response.json({
      success: true,
      ...results,
      message: dry_run 
        ? `Dry run complete: ${results.total_updated} records would be updated` 
        : `Backfill complete: ${results.total_updated} records updated`
    });

  } catch (error) {
    console.error('[backfillV2CatalogCaches] Error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});