import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { limit = 500 } = await req.json().catch(() => ({}));

    // Load all PriceListItems into a map
    const priceListItems = await base44.entities.PriceListItem.list();
    const itemMap = {};
    for (const item of priceListItems) {
      if (item.id) {
        itemMap[item.id] = item.item || item.name || item.title || null;
      }
    }

    const results = {
      requirements: { scanned: 0, updated: 0, skipped: 0, missing_label: 0 },
      allocations: { scanned: 0, updated: 0, skipped: 0, missing_label: 0 },
      consumptions: { scanned: 0, updated: 0, skipped: 0, missing_label: 0 },
    };

    // Backfill ProjectRequirementLine
    const requirements = await base44.asServiceRole.entities.ProjectRequirementLine.list('-updated_date', limit);
    for (const req of requirements) {
      results.requirements.scanned++;
      
      const needsUpdate = !req.catalog_item_id || !req.catalog_item_name;
      if (!needsUpdate) {
        results.requirements.skipped++;
        continue;
      }

      const partId = req.catalog_item_id || req.price_list_item_id;
      const label = req.catalog_item_name || (partId && itemMap[partId]) || null;

      if (!label && !partId) {
        results.requirements.skipped++;
        continue;
      }

      const updateData = {};
      if (!req.catalog_item_id && partId) updateData.catalog_item_id = partId;
      if (!req.catalog_item_name && label) updateData.catalog_item_name = label;

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.ProjectRequirementLine.update(req.id, updateData);
        results.requirements.updated++;
      } else {
        if (!label) results.requirements.missing_label++;
        results.requirements.skipped++;
      }
    }

    // Backfill StockAllocation
    const allocations = await base44.asServiceRole.entities.StockAllocation.list('-updated_date', limit);
    for (const alloc of allocations) {
      results.allocations.scanned++;
      
      const needsUpdate = !alloc.catalog_item_id || !alloc.catalog_item_name;
      if (!needsUpdate) {
        results.allocations.skipped++;
        continue;
      }

      const partId = alloc.catalog_item_id || alloc.price_list_item_id;
      const label = alloc.catalog_item_name || (partId && itemMap[partId]) || null;

      if (!label && !partId) {
        results.allocations.skipped++;
        continue;
      }

      const updateData = {};
      if (!alloc.catalog_item_id && partId) updateData.catalog_item_id = partId;
      if (!alloc.catalog_item_name && label) updateData.catalog_item_name = label;

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.StockAllocation.update(alloc.id, updateData);
        results.allocations.updated++;
      } else {
        if (!label) results.allocations.missing_label++;
        results.allocations.skipped++;
      }
    }

    // Backfill StockConsumption
    const consumptions = await base44.asServiceRole.entities.StockConsumption.list('-updated_date', limit);
    for (const cons of consumptions) {
      results.consumptions.scanned++;
      
      const needsUpdate = !cons.catalog_item_id || !cons.catalog_item_name;
      if (!needsUpdate) {
        results.consumptions.skipped++;
        continue;
      }

      const partId = cons.catalog_item_id || cons.price_list_item_id;
      const label = cons.catalog_item_name || (partId && itemMap[partId]) || null;

      if (!label && !partId) {
        results.consumptions.skipped++;
        continue;
      }

      const updateData = {};
      if (!cons.catalog_item_id && partId) updateData.catalog_item_id = partId;
      if (!cons.catalog_item_name && label) updateData.catalog_item_name = label;

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.StockConsumption.update(cons.id, updateData);
        results.consumptions.updated++;
      } else {
        if (!label) results.consumptions.missing_label++;
        results.consumptions.skipped++;
      }
    }

    return Response.json({ 
      success: true, 
      results,
      summary: `Requirements: ${results.requirements.updated} updated, Allocations: ${results.allocations.updated} updated, Consumptions: ${results.consumptions.updated} updated`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});