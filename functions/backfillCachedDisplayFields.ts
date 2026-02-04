import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const audit = {
      scanned: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    // Backfill Receipt
    await backfillEntity(base44, 'Receipt', audit, [
      { cachedFields: ['project_number', 'title'], refEntity: 'Project', refField: 'project_id' },
    ]);

    // Backfill ReceiptLine
    await backfillEntity(base44, 'ReceiptLine', audit, [
      { cachedFields: ['item_name'], refEntity: 'PriceListItem', refField: 'catalog_item_id' },
    ]);

    // Backfill StockAllocation
    await backfillEntity(base44, 'StockAllocation', audit, [
      { cachedFields: ['item_name'], refEntity: 'PriceListItem', refField: 'catalog_item_id' },
    ]);

    // Backfill StockConsumption
    await backfillEntity(base44, 'StockConsumption', audit, [
      { cachedFields: ['item_name'], refEntity: 'PriceListItem', refField: 'catalog_item_id' },
    ]);

    // Backfill LogisticsRun
    await backfillEntity(base44, 'LogisticsRun', audit, [
      { cachedFields: ['assigned_to_name'], refEntity: 'User', refField: 'assigned_to_user_id' },
      { cachedFields: ['vehicle_name'], refEntity: 'Vehicle', refField: 'vehicle_id' },
    ]);

    // Backfill LogisticsStop
    await backfillEntity(base44, 'LogisticsStop', audit, [
      { cachedFields: ['location_name'], refEntity: 'InventoryLocation', refField: 'location_id' },
      { cachedFields: ['project_number', 'project_title'], refEntity: 'Project', refField: 'project_id' },
      { cachedFields: ['purchase_order_number', 'supplier_name'], refEntity: 'PurchaseOrder', refField: 'purchase_order_id' },
    ]);

    // Backfill ProjectRequirementLine
    await backfillEntity(base44, 'ProjectRequirementLine', audit, [
      { cachedFields: ['catalog_item_name', 'catalog_item_sku'], refEntity: 'PriceListItem', refField: 'catalog_item_id' },
    ]);

    return Response.json({
      success: true,
      audit,
      summary: `Scanned ${audit.scanned} records. Updated ${audit.updated}, skipped ${audit.skipped}, errors ${audit.errors}.`,
    });
  } catch (error) {
    console.error('Backfill failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function backfillEntity(base44, entityName, audit, fieldMappings) {
  console.log(`\n--- Backfilling ${entityName} ---`);

  let offset = 0;
  const batchSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const records = await base44.asServiceRole.entities[entityName].list(
        '-created_date',
        batchSize,
        offset
      );

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of records) {
        audit.scanned++;
        let updated = false;

        for (const mapping of fieldMappings) {
          const refId = record[mapping.refField];
          if (!refId) continue;

          // Check if any cached field is missing
          const needsUpdate = mapping.cachedFields.some(field => !record[field]);
          if (!needsUpdate) {
            continue;
          }

          try {
            const refRecord = await base44.asServiceRole.entities[mapping.refEntity].get(refId);
            if (!refRecord) continue;

            const updates = {};
            let hasUpdates = false;

            if (mapping.refEntity === 'Project') {
              if (!record.project_number && refRecord.project_number) {
                updates.project_number = refRecord.project_number;
                hasUpdates = true;
              }
              if (!record.title && refRecord.title) {
                updates.title = refRecord.title;
                hasUpdates = true;
              }
            } else if (mapping.refEntity === 'PriceListItem') {
              if (!record.item_name && refRecord.item) {
                updates.item_name = refRecord.item;
                hasUpdates = true;
              }
            } else if (mapping.refEntity === 'InventoryLocation') {
              if (!record.location_name && refRecord.name) {
                updates.location_name = refRecord.name;
                hasUpdates = true;
              }
            } else if (mapping.refEntity === 'Vehicle') {
              if (!record.vehicle_name && refRecord.name) {
                updates.vehicle_name = refRecord.name;
                hasUpdates = true;
              }
            } else if (mapping.refEntity === 'User') {
              if (!record.assigned_to_name && (refRecord.full_name || refRecord.email)) {
                updates.assigned_to_name = refRecord.full_name || refRecord.email;
                hasUpdates = true;
              }
            } else if (mapping.refEntity === 'PurchaseOrder') {
              if (!record.purchase_order_number && refRecord.purchase_order_number) {
                updates.purchase_order_number = refRecord.purchase_order_number;
                hasUpdates = true;
              }
              if (!record.supplier_name && refRecord.supplier_name) {
                updates.supplier_name = refRecord.supplier_name;
                hasUpdates = true;
              }
            }

            // Handle PriceListItem for both ReceiptLine/StockAllocation/StockConsumption AND ProjectRequirementLine
            if (mapping.refEntity === 'PriceListItem') {
              if (!record.catalog_item_name && refRecord.item) {
                updates.catalog_item_name = refRecord.item;
                hasUpdates = true;
              }
              if (!record.catalog_item_sku && refRecord.sku) {
                updates.catalog_item_sku = refRecord.sku;
                hasUpdates = true;
              }
            }

            // Handle Project for LogisticsStop (project_number + project_title fields)
            if (mapping.refEntity === 'Project' && entityName === 'LogisticsStop') {
              if (!record.project_number && refRecord.project_number) {
                updates.project_number = refRecord.project_number;
                hasUpdates = true;
              }
              if (!record.project_title && refRecord.title) {
                updates.project_title = refRecord.title;
                hasUpdates = true;
              }
            }

            if (hasUpdates) {
              await base44.asServiceRole.entities[entityName].update(record.id, updates);
              audit.updated++;
              updated = true;
              console.log(`  Updated ${entityName} ${record.id}`);
            }
          } catch (refError) {
            audit.errors++;
            console.error(`  Error fetching ${mapping.refEntity} ${refId}:`, refError.message);
          }
        }

        if (!updated) {
          audit.skipped++;
        }
      }

      offset += batchSize;
    } catch (error) {
      console.error(`Error processing ${entityName} batch at offset ${offset}:`, error.message);
      audit.errors++;
      break;
    }
  }

  console.log(`${entityName}: Updated ${audit.updated}, Skipped ${audit.skipped}`);
}