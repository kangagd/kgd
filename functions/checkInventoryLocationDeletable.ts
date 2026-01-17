import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only validation
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { location_id } = payload;

    if (!location_id) {
      return Response.json({ error: 'Missing required parameter: location_id' }, { status: 400 });
    }

    // Step 1: Validate location exists
    let location;
    try {
      location = await base44.asServiceRole.entities.InventoryLocation.get(location_id);
    } catch (err) {
      return Response.json({
        deletable: false,
        reason: 'Location not found'
      });
    }

    // Step 2: Query InventoryQuantity references
    const inventoryQuantities = await base44.asServiceRole.entities.InventoryQuantity.filter({
      location_id: location_id
    });
    const inventoryCount = inventoryQuantities.length;
    const inventoryTotal = inventoryQuantities.reduce((sum, q) => sum + (q.quantity || 0), 0);

    // Step 3: Query StockMovement references (from or to this location)
    const stockMovementsFrom = await base44.asServiceRole.entities.StockMovement.filter({
      from_location_id: location_id
    });
    const stockMovementsTo = await base44.asServiceRole.entities.StockMovement.filter({
      to_location_id: location_id
    });
    const stockMovementCount = stockMovementsFrom.length + stockMovementsTo.length;

    // Step 4: Query PurchaseOrderLine references
    const poLineReferences = await base44.asServiceRole.entities.PurchaseOrderLine.filter({
      destination_location_id: location_id
    });
    const poReferenceCount = poLineReferences.length;

    // Decision logic
    const isDeletable = inventoryCount === 0 && stockMovementCount === 0 && poReferenceCount === 0;

    if (!isDeletable) {
      return Response.json({
        deletable: false,
        blocking_reasons: {
          inventory_rows: inventoryCount,
          inventory_total_quantity: inventoryTotal,
          stock_movements: stockMovementCount,
          po_references: poReferenceCount
        },
        message: 'InventoryLocation cannot be deleted safely',
        location_info: {
          id: location.id,
          name: location.name,
          type: location.type
        }
      });
    }

    return Response.json({
      deletable: true,
      message: 'InventoryLocation is safe to delete',
      checks: {
        inventory_rows: inventoryCount,
        inventory_total_quantity: inventoryTotal,
        stock_movements: stockMovementCount,
        po_references: poReferenceCount
      },
      location_info: {
        id: location.id,
        name: location.name,
        type: location.type
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});