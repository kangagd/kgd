import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Process stock consumption by creating a StockMovement to CONSUMED location.
 * Validates remaining allocation qty and marks allocation as consumed if depleted.
 *
 * Idempotency key format: CONSUME:{consumption_id}:{source_allocation_id}
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { consumption_id } = body;

    if (!consumption_id) {
      return Response.json(
        { error: 'consumption_id is required' },
        { status: 400 }
      );
    }

    // Load consumption
    const consumption = await base44.asServiceRole.entities.StockConsumption.get(
      consumption_id
    );
    if (!consumption) {
      return Response.json(
        { error: 'StockConsumption not found' },
        { status: 404 }
      );
    }

    const qtyConsumed = consumption.qty_consumed || 0;

    // Ensure CONSUMED location exists (virtual location)
    let consumedLocation = null;
    const existingConsumedLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
      location_code: 'CONSUMED',
    });

    if (existingConsumedLocs.length > 0) {
      consumedLocation = existingConsumedLocs[0];
    } else {
      // Create CONSUMED virtual location
      consumedLocation = await base44.asServiceRole.entities.InventoryLocation.create({
        name: 'Consumed',
        location_code: 'CONSUMED',
        type: 'warehouse',
        location_type: 'virtual',
        is_active: true,
        description: 'Virtual location for consumed items',
      });
    }

    let fromLocation = null;
    let allocation = null;

    // If source allocation exists, validate and compute movement
    if (consumption.source_allocation_id) {
      allocation = await base44.asServiceRole.entities.StockAllocation.get(
        consumption.source_allocation_id
      );

      if (!allocation) {
        return Response.json(
          { error: 'Source allocation not found' },
          { status: 404 }
        );
      }

      // Get prior consumptions for this allocation
      const priorConsumptions = await base44.asServiceRole.entities.StockConsumption.filter(
        {
          source_allocation_id: consumption.source_allocation_id,
          created_date: { $lt: consumption.created_date || new Date().toISOString() },
        }
      );

      const priorQty = priorConsumptions.reduce(
        (sum, c) => sum + (c.qty_consumed || 0),
        0
      );
      const remainingAfter = (allocation.qty_allocated || 0) - priorQty - qtyConsumed;

      if (remainingAfter < 0) {
        return Response.json(
          {
            error: `Insufficient qty on allocation (available: ${(allocation.qty_allocated || 0) - priorQty}, requested: ${qtyConsumed})`,
          },
          { status: 400 }
        );
      }

      // Determine from_location: use allocation's from_location_id or fallback
      fromLocation = allocation.from_location_id;
      if (!fromLocation) {
        // Fallback: if allocation linked to vehicle, use vehicle location; else warehouse
        if (allocation.vehicle_id) {
          const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
            vehicle_id: allocation.vehicle_id,
          });
          fromLocation = vehicleLocs.length > 0 ? vehicleLocs[0].id : null;
        }
      }

      // If still no from_location, use warehouse main
      if (!fromLocation) {
        const warehouseLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
          location_code: 'WAREHOUSE_MAIN',
        });
        fromLocation = warehouseLocs.length > 0 ? warehouseLocs[0].id : null;
      }
    } else {
      // Ad-hoc consumption: use provided consumed_from_location_id
      fromLocation = consumption.consumed_from_location_id;
      if (!fromLocation) {
        // Fallback to warehouse main
        const warehouseLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
          location_code: 'WAREHOUSE_MAIN',
        });
        fromLocation = warehouseLocs.length > 0 ? warehouseLocs[0].id : null;
      }
    }

    // Fetch from/to location names
    let fromLocationName = 'Unknown';
    let toLocationName = consumedLocation.name;

    if (fromLocation) {
      const fromLoc = await base44.asServiceRole.entities.InventoryLocation.get(
        fromLocation
      );
      if (fromLoc) fromLocationName = fromLoc.name;
    }

    // Create StockMovement with idempotency key
    const idempotencyKey = `CONSUME:${consumption_id}:${allocation ? allocation.id : 'adhoc'}`;

    // Check for existing movement
    const existingMovements = await base44.asServiceRole.entities.StockMovement.filter({
      idempotency_key: idempotencyKey,
    });

    if (existingMovements.length > 0) {
      // Movement already created, return success
      return Response.json({
        success: true,
        consumption_id,
        movement_id: existingMovements[0].id,
        is_duplicate: true,
      });
    }

    // Create new movement
    const movement = await base44.asServiceRole.entities.StockMovement.create({
      idempotency_key: idempotencyKey,
      source: 'receipt_clear',
      quantity: qtyConsumed,
      from_location_id: fromLocation,
      from_location_name: fromLocationName,
      to_location_id: consumedLocation.id,
      to_location_name: toLocationName,
      performed_by_user_id: consumption.consumed_by_user_id,
      performed_by_user_email: user.email,
      performed_by_user_name: consumption.consumed_by_name,
      performed_at: consumption.consumed_at || new Date().toISOString(),
      project_id: consumption.project_id,
      visit_id: consumption.visit_id,
      job_id: consumption.job_id,
      catalog_item_id: consumption.catalog_item_id,
      description: consumption.description,
      notes: consumption.notes,
    });

    // If allocation exists and is fully consumed, mark as consumed
    if (allocation) {
      const allConsumptions = await base44.asServiceRole.entities.StockConsumption.filter(
        {
          source_allocation_id: allocation.id,
        }
      );

      const totalConsumed = allConsumptions.reduce(
        (sum, c) => sum + (c.qty_consumed || 0),
        0
      );

      if (totalConsumed >= (allocation.qty_allocated || 0)) {
        await base44.asServiceRole.entities.StockAllocation.update(
          allocation.id,
          {
            status: 'consumed',
          }
        );
      }
    }

    // Trigger visit readiness recompute if visit_id exists
    if (consumption.visit_id) {
      try {
        await base44.functions.invoke('computeVisitReadiness', {
          visit_id: consumption.visit_id,
        });
      } catch (err) {
        console.warn('Failed to recompute visit readiness:', err);
      }
    }

    return Response.json({
      success: true,
      consumption_id,
      movement_id: movement.id,
      is_duplicate: false,
      allocation_status: allocation ? allocation.status : null,
    });
  } catch (error) {
    console.error('consumeAllocatedStock error:', error);
    return Response.json(
      { error: error.message || 'Failed to consume stock' },
      { status: 500 }
    );
  }
});