import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
 
    // Fetch latest 20 allocations
    const allocations = await base44.asServiceRole.entities.StockAllocation.list('-updated_date', 20);

    const sample = allocations.map(a => ({
      id: a.id,
      project_id: a.project_id,
      job_id: a.job_id,
      visit_id: a.visit_id,
      requirement_line_id: a.requirement_line_id,
      catalog_item_id: a.catalog_item_id,
      price_list_item_id: a.price_list_item_id,
      sku_id: a.sku_id,
      item_name: a.item_name,
      catalog_item_name: a.catalog_item_name,
      price_list_item_name: a.price_list_item_name,
      description: a.description,
    }));

    // Get all keys for first 3 records
    const keys_sample = allocations.slice(0, 3).map(a => ({
      id: a.id,
      keys: Object.keys(a),
    }));

    return Response.json({
      success: true,
      sample,
      keys_sample,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});