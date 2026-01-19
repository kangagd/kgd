import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Migrate Suppliers to InventoryLocation records
 * Creates InventoryLocation records for suppliers that don't have them yet
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    // Get all suppliers
    const suppliers = await base44.asServiceRole.entities.Supplier.list();
    
    // Get all existing inventory locations
    const locations = await base44.asServiceRole.entities.InventoryLocation.list();
    const existingSupplierLocations = locations.filter(loc => loc.type === 'supplier');
    const existingSupplierIds = new Set(existingSupplierLocations.map(loc => loc.supplier_id));

    const results = {
      total_suppliers: suppliers.length,
      existing_locations: existingSupplierLocations.length,
      to_create: [],
      created: [],
      errors: []
    };

    // Create locations for suppliers that don't have them
    for (const supplier of suppliers) {
      if (!existingSupplierIds.has(supplier.id)) {
        const locationData = {
          name: `${supplier.name} (Supplier)`,
          type: 'supplier',
          supplier_id: supplier.id,
          is_active: supplier.is_active !== false,
          address: supplier.pickup_address || supplier.address_full || '',
          description: `Auto-created supplier location for ${supplier.name}`
        };

        results.to_create.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          location_data: locationData
        });

        if (!dryRun) {
          try {
            const location = await base44.asServiceRole.entities.InventoryLocation.create(locationData);
            results.created.push({
              supplier_id: supplier.id,
              location_id: location.id,
              name: location.name
            });
          } catch (err) {
            results.errors.push({
              supplier_id: supplier.id,
              error: err.message
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});