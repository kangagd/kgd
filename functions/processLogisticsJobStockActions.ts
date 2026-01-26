import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ORCHESTRATOR: processLogisticsJobStockActions
 *
 * Manages stock movements for logistics jobs by calling canonical writers.
 * Does NOT directly mutate InventoryQuantity or StockMovement.
 * Delegates to receivePoItems (PO receipt) or moveInventory (transfers).
 *
 * Input payload:
 * {
 *   "job_id": "string (required)",
 *   "mode": "po_receipt" | "transfer" (required)",
 *   "location_id": "string (required for po_receipt)",
 *   "items": [{ "purchase_order_line_id": "string", "qty": number }] (po_receipt),
 *   "transfer_items": [{ "price_list_item_id": "string", "qty": number }] (transfer),
 *   "from_location_id": "string (transfer)",
 *   "to_location_id": "string (transfer)",
 *   "notes": "string (optional)"
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      job_id,
      mode,
      location_id,
      items,
      transfer_items,
      from_location_id,
      to_location_id,
      notes
    } = await req.json();

    // Validate required fields
    if (!job_id || !mode) {
      return Response.json({
        error: 'Missing required fields: job_id, mode'
      }, { status: 400 });
    }

    if (!['po_receipt', 'transfer'].includes(mode)) {
      return Response.json({
        error: 'Invalid mode. Must be po_receipt or transfer'
      }, { status: 400 });
    }

    // Load job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.is_logistics_job) {
      return Response.json({
        error: 'Job is not a logistics job'
      }, { status: 400 });
    }

    // IDEMPOTENCY: If already completed, return success
    if (job.stock_transfer_status === 'completed') {
      return Response.json({
        success: true,
        message: 'Transfer already completed for this logistics job',
        batch_id: job.linked_stock_movement_batch_id,
        items_processed: 0,
        already_completed: true
      });
    }

    // AUTHORIZATION
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isTechnician = user.is_field_technician === true || user.extended_role === 'technician';

    if (!isAdmin && !isManager && !isTechnician) {
      return Response.json({
        error: 'Forbidden: Only admin, manager, or technician can process stock actions'
      }, { status: 403 });
    }

    // TECHNICIAN CONSTRAINTS: Validate transfer routes
    if (isTechnician && !isAdmin && !isManager) {
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
        assigned_user_id: user.id,
        is_active: true
      });

      if (vehicles.length !== 1) {
        return Response.json({
          error: 'Technician must have exactly one active assigned vehicle'
        }, { status: 403 });
      }

      const techVehicle = vehicles[0];

      // Get tech's vehicle location
      const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: techVehicle.id,
        is_active: true
      });

      if (vehicleLocations.length === 0) {
        return Response.json({
          error: 'Vehicle has no inventory location configured'
        }, { status: 400 });
      }

      const vehicleLoc = vehicleLocations[0];

      // Get main warehouse
      const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'warehouse',
        is_active: true
      });

      if (warehouses.length === 0) {
        return Response.json({
          error: 'No warehouse location configured'
        }, { status: 400 });
      }

      const warehouseLoc = warehouses[0];

      // Validate routes based on mode
      if (mode === 'po_receipt') {
        // Receiving can only go to warehouse or vehicle
        const receiveLocation = location_id || job.destination_location_id;
        if (!receiveLocation) {
          return Response.json({
            error: 'location_id required for po_receipt'
          }, { status: 400 });
        }

        const allowedLocations = [warehouseLoc.id, vehicleLoc.id];
        if (!allowedLocations.includes(receiveLocation)) {
          return Response.json({
            error: 'Technicians can only receive to main warehouse or their assigned vehicle'
          }, { status: 403 });
        }
      } else if (mode === 'transfer') {
        // Transfer only between warehouse <-> vehicle
        const isWarehouseToVehicle = from_location_id === warehouseLoc.id && to_location_id === vehicleLoc.id;
        const isVehicleToWarehouse = from_location_id === vehicleLoc.id && to_location_id === warehouseLoc.id;

        if (!isWarehouseToVehicle && !isVehicleToWarehouse) {
          return Response.json({
            error: 'Technicians can only transfer between main warehouse and their assigned vehicle'
          }, { status: 403 });
        }
      }
    }

    // EXECUTE BASED ON MODE
    let result;

    if (mode === 'po_receipt') {
      result = await handlePoReceipt(base44, user, job, location_id, items, notes);
    } else if (mode === 'transfer') {
      result = await handleTransfer(base44, user, job, from_location_id, to_location_id, transfer_items, notes);
    }

    if (!result.success) {
      return Response.json(result, { status: result.status || 400 });
    }

    // UPDATE JOB STATUS
    const batchId = `logistics_job_${job_id}_${Date.now()}`;
    await base44.asServiceRole.entities.Job.update(job_id, {
      stock_transfer_status: 'completed',
      linked_stock_movement_batch_id: batchId
    });

    return Response.json({
      success: true,
      message: `Stock actions completed for logistics job ${job.job_number || job_id}`,
      batch_id: batchId,
      mode: mode,
      items_processed: result.items_processed,
      canonical_function: result.canonical_function,
      details: result.details
    });

  } catch (error) {
    console.error('[processLogisticsJobStockActions] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Handle PO receipt mode: call receivePoItems
 */
async function handlePoReceipt(base44, user, job, location_id, items, notes) {
  if (!job.purchase_order_id) {
    return {
      success: false,
      status: 400,
      error: 'Job has no purchase_order_id. Cannot receive PO items.'
    };
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'items array required for po_receipt mode'
    };
  }

  // Determine receive location (default to job.destination_location_id or warehouse)
  let receiveLocationId = location_id || job.destination_location_id;

  if (!receiveLocationId) {
    // Fallback to main warehouse
    const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'warehouse',
      is_active: true
    });

    if (warehouses.length === 0) {
      return {
        success: false,
        status: 400,
        error: 'No location specified and no warehouse found'
      };
    }

    receiveLocationId = warehouses[0].id;
  }

  // Invoke receivePoItems via function orchestration
  const payload = {
    po_id: job.purchase_order_id,
    items: items,
    destination_location_id: receiveLocationId,
    notes: notes ? `Logistics Job ${job.job_number || job.id}: ${notes}` : null,
    reference_type: 'job',
    reference_id: job.id
  };

  try {
    const response = await base44.functions.invoke('receivePoItems', payload);

    if (!response.data.success) {
      return {
        success: false,
        status: 400,
        error: response.data.error || 'PO receipt failed',
        details: response.data
      };
    }

    return {
      success: true,
      items_processed: response.data.items_received || items.length,
      canonical_function: 'receivePoItems',
      details: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: 500,
      error: `Failed to invoke receivePoItems: ${error.message}`
    };
  }
}

/**
 * Handle transfer mode: call moveInventory for each item
 */
async function handleTransfer(base44, user, job, from_location_id, to_location_id, transfer_items, notes) {
  if (!from_location_id || !to_location_id) {
    return {
      success: false,
      status: 400,
      error: 'from_location_id and to_location_id required for transfer mode'
    };
  }

  if (!transfer_items || transfer_items.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'transfer_items array required for transfer mode'
    };
  }

  let itemsProcessed = 0;
  const movedItems = [];

  // Move each item via canonical moveInventory
  for (const item of transfer_items) {
    const { price_list_item_id, qty } = item;

    if (!price_list_item_id || !qty || qty <= 0) {
      continue;
    }

    const payload = {
      priceListItemId: price_list_item_id,
      fromLocationId: from_location_id,
      toLocationId: to_location_id,
      quantity: qty,
      source: 'transfer',
      jobId: job.id,
      notes: notes ? `Logistics Job ${job.job_number || job.id}: ${notes}` : null
    };

    try {
      const response = await base44.functions.invoke('moveInventory', payload);

      if (response.data.success) {
        itemsProcessed++;
        movedItems.push({
          price_list_item_id,
          qty,
          message: response.data.message
        });
      }
    } catch (error) {
      console.warn(`Failed to move item ${price_list_item_id}:`, error.message);
      // Continue processing other items
    }
  }

  if (itemsProcessed === 0) {
    return {
      success: false,
      status: 400,
      error: 'No items were successfully transferred'
    };
  }

  return {
    success: true,
    items_processed: itemsProcessed,
    canonical_function: 'moveInventory',
    details: {
      moved_items: movedItems
    }
  };
}