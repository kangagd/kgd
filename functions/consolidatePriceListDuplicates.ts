import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Duplicate pairs to consolidate (name + SKU variants)
    const duplicatePairs = [
      { name: 'Merlin SilentDrive Elite Motor' },
      { name: 'Merlin Commander Elite Motor' },
      { name: 'CodeEzy Safety Beams' },
      { name: 'MyQ WiFi Kit' },
      { name: 'Spring #4' },
      { name: 'Galvanised Steel Post' },
      { name: 'Powdercoated Steel Post' }
    ];

    const allItems = await base44.entities.PriceListItem.list();
    
    const results = {
      consolidated: [],
      errors: []
    };

    for (const pair of duplicatePairs) {
      try {
        // Find all items matching this name
        const matching = allItems.filter(item => 
          item.item?.toLowerCase() === pair.name.toLowerCase()
        );

        if (matching.length < 2) {
          results.errors.push({ name: pair.name, error: 'Less than 2 items found' });
          continue;
        }

        // Sort by created_date to identify Jan 2 vs Jan 17
        matching.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        
        const jan2Item = matching[0]; // Older (Jan 2)
        const jan17Items = matching.slice(1); // Newer (Jan 17)

        // Update Jan 2 with quantities from Jan 17 items
        const totalStock = jan17Items.reduce((sum, item) => sum + (item.stock_level || 0), 0);
        
        await base44.entities.PriceListItem.update(jan2Item.id, {
          stock_level: totalStock,
          // Keep labour_hours, target_margin, no_techs from Jan 2 (already set)
        });

        // Deactivate all Jan 17 duplicates
        for (const jan17Item of jan17Items) {
          await base44.entities.PriceListItem.update(jan17Item.id, {
            is_active: false
          });
        }

        results.consolidated.push({
          name: pair.name,
          keptId: jan2Item.id,
          keptSKU: jan2Item.sku,
          consolidatedQuantity: totalStock,
          deactivatedCount: jan17Items.length
        });

      } catch (error) {
        results.errors.push({ 
          name: pair.name, 
          error: error.message 
        });
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});