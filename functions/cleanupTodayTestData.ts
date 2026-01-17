import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Delete InventoryQuantity records created today
    const quantities = await base44.asServiceRole.entities.InventoryQuantity.filter({
      created_date: {
        $gte: today.toISOString(),
        $lt: tomorrow.toISOString()
      }
    });

    let deletedQuantities = 0;
    for (const q of quantities) {
      await base44.asServiceRole.entities.InventoryQuantity.delete(q.id);
      deletedQuantities++;
    }

    // Delete StockMovement records created today
    const movements = await base44.asServiceRole.entities.StockMovement.filter({
      created_date: {
        $gte: today.toISOString(),
        $lt: tomorrow.toISOString()
      }
    });

    let deletedMovements = 0;
    for (const m of movements) {
      await base44.asServiceRole.entities.StockMovement.delete(m.id);
      deletedMovements++;
    }

    return Response.json({
      success: true,
      deleted: {
        inventoryQuantities: deletedQuantities,
        stockMovements: deletedMovements
      },
      date: today.toISOString().split('T')[0]
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});