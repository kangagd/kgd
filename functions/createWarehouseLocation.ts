import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Creates a warehouse location in InventoryLocation
 * Supports creating multiple warehouses for future scalability
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { name = 'Main Warehouse', address = '', is_primary = true } = body;

    // Check if warehouse with this name already exists
    const existing = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'warehouse',
      name: name
    });

    if (existing.length > 0) {
      return Response.json({
        success: false,
        error: 'Warehouse location already exists',
        warehouse: existing[0]
      });
    }

    // Create warehouse location
    const warehouse = await base44.asServiceRole.entities.InventoryLocation.create({
      name: name,
      type: 'warehouse',
      address: address,
      is_active: true,
      is_primary: is_primary,
      notes: 'Created via warehouse setup'
    });

    return Response.json({
      success: true,
      warehouse: warehouse,
      message: `Warehouse "${name}" created successfully`
    });

  } catch (error) {
    console.error('Create warehouse location error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});