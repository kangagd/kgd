import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { allocation_id, catalog_item_id, also_create_requirement } = payload;

    if (!allocation_id || !catalog_item_id) {
      return Response.json(
        { error: 'Missing required fields: allocation_id, catalog_item_id' },
        { status: 400 }
      );
    }

    // Load allocation
    const allocation = await base44.asServiceRole.entities.StockAllocation.get(allocation_id);
    if (!allocation) {
      return Response.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Load PriceListItem to get name
    const priceListItem = await base44.asServiceRole.entities.PriceListItem.get(catalog_item_id);
    if (!priceListItem) {
      return Response.json({ error: 'PriceListItem not found' }, { status: 404 });
    }

    const itemName = priceListItem.item || priceListItem.name || 'Item';

    // Update allocation with catalog data
    const updateData = {
      catalog_item_id: catalog_item_id,
      catalog_item_name: itemName,
      needs_relink: false,
      label_source: 'manual_relink'
    };

    let newRequirementId = null;

    // Optionally create new requirement line
    if (also_create_requirement && allocation.project_id) {
      const newRequirement = await base44.asServiceRole.entities.ProjectRequirementLine.create({
        project_id: allocation.project_id,
        catalog_item_id: catalog_item_id,
        catalog_item_name: itemName,
        qty_required: allocation.qty_allocated,
        priority: 'main',
        status: 'allocated'
      });

      newRequirementId = newRequirement.id;
      updateData.requirement_line_id = newRequirementId;
    }

    // Apply updates
    const updatedAllocation = await base44.asServiceRole.entities.StockAllocation.update(
      allocation_id,
      updateData
    );

    return Response.json({
      success: true,
      allocation: updatedAllocation,
      new_requirement_id: newRequirementId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});