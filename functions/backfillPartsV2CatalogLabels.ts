import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Check if a label is a placeholder that should be overwritten
 */
function isPlaceholder(label) {
  if (!label || typeof label !== 'string') return true;
  
  const normalized = label.trim().toLowerCase();
  
  // Empty or very short
  if (normalized.length === 0 || normalized === '-') return true;
  
  // Common placeholders
  const placeholders = ['part', 'item', 'unknown', 'n/a', 'na'];
  if (placeholders.includes(normalized)) return true;
  
  // Raw ID-like strings (12+ hex chars)
  if (/^[a-f0-9]{12,}$/.test(normalized)) return true;
  
  return false;
}

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
      requirements: { scanned: 0, updated: 0, skipped: 0, missing_label: 0, overwritten_placeholder: 0 },
      allocations: { scanned: 0, updated: 0, skipped: 0, missing_label: 0, overwritten_placeholder: 0 },
      consumptions: { scanned: 0, updated: 0, skipped: 0, missing_label: 0, overwritten_placeholder: 0 },
    };

    // Backfill ProjectRequirementLine
    const requirements = await base44.asServiceRole.entities.ProjectRequirementLine.list('-updated_date', limit);
    for (const req of requirements) {
      results.requirements.scanned++;
      
      const needsUpdate = (
        !req.catalog_item_id ||
        !req.catalog_item_name ||
        isPlaceholder(req.catalog_item_name)
      );
      
      if (!needsUpdate) {
        results.requirements.skipped++;
        continue;
      }

      const catalogRefId = req.price_list_item_id || req.catalog_item_id;
      
      if (!catalogRefId) {
        results.requirements.missing_label++;
        results.requirements.skipped++;
        continue;
      }
      
      const label = itemMap[catalogRefId];
      
      if (!label || isPlaceholder(label)) {
        results.requirements.missing_label++;
        results.requirements.skipped++;
        continue;
      }

      const updateData = {};
      if (!req.catalog_item_id) updateData.catalog_item_id = catalogRefId;
      updateData.catalog_item_name = label; // Always overwrite if placeholder
      
      if (isPlaceholder(req.catalog_item_name)) {
        results.requirements.overwritten_placeholder++;
      }

      await base44.asServiceRole.entities.ProjectRequirementLine.update(req.id, updateData);
      results.requirements.updated++;
    }

    // Backfill StockAllocation
    const allocations = await base44.asServiceRole.entities.StockAllocation.list('-updated_date', limit);
    
    // Batch fetch requirements for allocations that reference them
    const requirementIds = [...new Set(
      allocations
        .filter(a => a.requirement_line_id)
        .map(a => a.requirement_line_id)
    )];
    
    const linkedRequirements = requirementIds.length > 0
      ? await base44.asServiceRole.entities.ProjectRequirementLine.filter({
          id: { $in: requirementIds }
        })
      : [];
    
    const requirementMap = {};
    for (const req of linkedRequirements) {
      requirementMap[req.id] = req;
    }
    
    const orphanAllocations = [];  // Track orphaned requirement references
    
    for (const alloc of allocations) {
      results.allocations.scanned++;
      
      const needsUpdate = (
        !alloc.catalog_item_id ||
        !alloc.catalog_item_name ||
        isPlaceholder(alloc.catalog_item_name)
      );
      
      if (!needsUpdate) {
        results.allocations.skipped++;
        continue;
      }

      // Get linked requirement if exists
      const requirement = alloc.requirement_line_id ? requirementMap[alloc.requirement_line_id] : null;
      
      // Priority order for partRefId
      const partRefId = 
        alloc.catalog_item_id ||
        alloc.price_list_item_id ||
        alloc.sku_id ||
        alloc.catalog_item ||
        alloc.price_list_item ||
        alloc.priceListItemId ||
        requirement?.catalog_item_id ||
        requirement?.price_list_item_id ||
        requirement?.sku_id ||
        null;
      
      // Priority order for label
      const label =
        (alloc.catalog_item_name && !isPlaceholder(alloc.catalog_item_name) ? alloc.catalog_item_name : null) ||
        (alloc.price_list_item_name && !isPlaceholder(alloc.price_list_item_name) ? alloc.price_list_item_name : null) ||
        (alloc.item_name && !isPlaceholder(alloc.item_name) ? alloc.item_name : null) ||
        (requirement?.catalog_item_name && !isPlaceholder(requirement.catalog_item_name) ? requirement.catalog_item_name : null) ||
        (requirement?.description && !isPlaceholder(requirement.description) ? requirement.description : null) ||
        (partRefId && itemMap[partRefId] && !isPlaceholder(itemMap[partRefId]) ? itemMap[partRefId] : null) ||
        null;
      
      // Handle case where we have label but no partRefId (ad-hoc allocations)
      if (!label) {
        results.allocations.missing_label++;
        results.allocations.skipped++;
        continue;
      }

      const updateData = {};
      
      // Set catalog_item_id if we have partRefId and it's missing
      if (partRefId && !alloc.catalog_item_id) {
        updateData.catalog_item_id = partRefId;
      }
      
      // Always set catalog_item_name if missing or placeholder
      if (!alloc.catalog_item_name || isPlaceholder(alloc.catalog_item_name)) {
        updateData.catalog_item_name = label;
      }
      
      // Also populate item_name for legacy/UI compatibility
      if (!alloc.item_name || isPlaceholder(alloc.item_name)) {
        updateData.item_name = label;
      }
      
      if (isPlaceholder(alloc.catalog_item_name)) {
        results.allocations.overwritten_placeholder++;
      }

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.StockAllocation.update(alloc.id, updateData);
        results.allocations.updated++;
      } else {
        results.allocations.skipped++;
      }
    }

    // Backfill StockConsumption
    const consumptions = await base44.asServiceRole.entities.StockConsumption.list('-updated_date', limit);
    for (const cons of consumptions) {
      results.consumptions.scanned++;
      
      const needsUpdate = (
        !cons.catalog_item_id ||
        !cons.catalog_item_name ||
        isPlaceholder(cons.catalog_item_name)
      );
      
      if (!needsUpdate) {
        results.consumptions.skipped++;
        continue;
      }

      const catalogRefId = cons.price_list_item_id || cons.catalog_item_id;
      
      if (!catalogRefId) {
        results.consumptions.missing_label++;
        results.consumptions.skipped++;
        continue;
      }
      
      const label = itemMap[catalogRefId];
      
      if (!label || isPlaceholder(label)) {
        results.consumptions.missing_label++;
        results.consumptions.skipped++;
        continue;
      }

      const updateData = {};
      if (!cons.catalog_item_id) updateData.catalog_item_id = catalogRefId;
      updateData.catalog_item_name = label; // Always overwrite if placeholder
      
      if (isPlaceholder(cons.catalog_item_name)) {
        results.consumptions.overwritten_placeholder++;
      }

      await base44.asServiceRole.entities.StockConsumption.update(cons.id, updateData);
      results.consumptions.updated++;
    }

    return Response.json({ 
      success: true, 
      results,
      summary: `Requirements: ${results.requirements.updated} updated (${results.requirements.overwritten_placeholder} placeholders), Allocations: ${results.allocations.updated} updated (${results.allocations.overwritten_placeholder} placeholders), Consumptions: ${results.consumptions.updated} updated (${results.consumptions.overwritten_placeholder} placeholders)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});