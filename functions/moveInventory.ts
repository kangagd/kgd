import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      priceListItemId, 
      fromLocationId, 
      toLocationId, 
      quantity, 
      movementType = null,
      source = null,
      jobId = null,
      vehicleId = null,
      notes = null,
      idempotency_key = null
    } = body;

    // Validate quantity
    if (!quantity || quantity <= 0) {
      return Response.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
    }

    // IDEMPOTENCY CHECK: Early check before any mutations
    if (idempotency_key) {
      const existingMovements = await base44.entities.StockMovement.filter({
        idempotency_key: idempotency_key
      });
      if (existingMovements.length > 0) {
        return Response.json({
          success: true,
          idempotent: true,
          message: `Movement already processed (idempotency_key: ${idempotency_key})`,
          updated_quantities: []
        });
      }
    }

    // Validate priceListItemId (required and must exist)
    if (!priceListItemId) {
      return Response.json({ error: 'ITEM_NOT_FOUND: price_list_item_id is required' }, { status: 400 });
    }

    const item = await base44.entities.PriceListItem.get(priceListItemId);
    if (!item) {
      return Response.json({ error: 'ITEM_NOT_FOUND: PriceListItem does not exist' }, { status: 404 });
    }

    // moveInventory is for transfers and job usage only (no legacy movementType support)
    let finalSource = source || 'transfer';
    const validSources = ['transfer', 'job_usage'];
    if (!validSources.includes(finalSource)) {
      return Response.json({ 
        error: `Invalid source "${finalSource}". moveInventory supports: ${validSources.join(', ')}. Use receivePoItems for PO receipt or adjustStockCorrection for admin corrections.` 
      }, { status: 400 });
    }

    // Transfer requires both locations; job_usage requires only source
    if (finalSource === 'transfer' && (!fromLocationId || !toLocationId)) {
      return Response.json({ error: 'Transfer requires both from and to locations' }, { status: 400 });
    }

    if (finalSource === 'job_usage' && !fromLocationId) {
      return Response.json({ error: 'Job usage requires source location' }, { status: 400 });
    }

    // TECHNICIAN AUTHORIZATION: enforce restrictions only for transfers
    if (user.role === 'technician' && finalSource === 'transfer') {
      // Resolve technician's assigned vehicle
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
        assigned_user_id: user.id,
        is_active: { $ne: false }
      });

      if (vehicles.length === 0) {
        return Response.json({ error: 'No vehicle assigned to this user' }, { status: 403 });
      }

      if (vehicles.length > 1) {
        return Response.json({ error: 'Multiple vehicles assigned; admin must resolve' }, { status: 409 });
      }

      const techVehicle = vehicles[0];

      // Resolve vehicle inventory location
      const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: techVehicle.id,
        is_active: { $ne: false }
      });

      if (vehicleLocs.length === 0) {
        return Response.json({ error: 'Vehicle inventory location missing. Run ensureVehicleInventoryLocations.' }, { status: 409 });
      }

      const vehicleLoc = vehicleLocs[0];

      // Resolve main warehouse
      const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'warehouse',
        is_active: { $ne: false }
      });

      if (warehouses.length === 0) {
        return Response.json({ error: 'No active warehouse location configured' }, { status: 409 });
      }

      const warehouseLoc = warehouses[0];

      // Enforce allowed routes: warehouse <-> vehicle only
      const isWarehouseToVehicle = fromLocationId === warehouseLoc.id && toLocationId === vehicleLoc.id;
      const isVehicleToWarehouse = fromLocationId === vehicleLoc.id && toLocationId === warehouseLoc.id;

      if (!isWarehouseToVehicle && !isVehicleToWarehouse) {
        return Response.json({ 
          error: 'Technicians can only transfer between the main warehouse and their assigned vehicle.' 
        }, { status: 403 });
      }
      }

      // For job_usage, enforce technician deducts from their own vehicle only
      if (user.role === 'technician' && finalSource === 'job_usage') {
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
        assigned_user_id: user.id,
        is_active: { $ne: false }
      });
      if (vehicles.length === 0) {
        return Response.json({ error: 'No vehicle assigned to this user' }, { status: 403 });
      }
      const techVehicle = vehicles[0];
      const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: techVehicle.id,
        is_active: { $ne: false }
      });
      if (vehicleLocs.length === 0) {
        return Response.json({ error: 'Vehicle inventory location missing' }, { status: 409 });
      }
      const vehicleLoc = vehicleLocs[0];
      if (fromLocationId !== vehicleLoc.id) {
        return Response.json({ 
          error: 'Technicians can only deduct from their assigned vehicle.' 
        }, { status: 403 });
      }
      }

      let fromLocation = null;
      let toLocation = null;

    // For transfers, validate source has enough stock
    if (fromLocationId) {
      fromLocation = await base44.entities.InventoryLocation.get(fromLocationId);
      if (!fromLocation) {
        return Response.json({ error: 'Source location not found' }, { status: 404 });
      }

      const sourceQuantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: fromLocationId
      });

      const currentQty = sourceQuantities[0]?.quantity || 0;
      if (currentQty < quantity) {
        return Response.json({ 
          error: `Insufficient stock at ${fromLocation.name}. Available: ${currentQty}, Requested: ${quantity}` 
        }, { status: 400 });
      }

      // Deduct from source
      if (sourceQuantities[0]) {
        await base44.entities.InventoryQuantity.update(sourceQuantities[0].id, {
          quantity: currentQty - quantity
        });
      }
    }

    // Add to destination
    if (toLocationId) {
      toLocation = await base44.entities.InventoryLocation.get(toLocationId);
      if (!toLocation) {
        return Response.json({ error: 'Destination location not found' }, { status: 404 });
      }

      const destQuantities = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: toLocationId
      });

      if (destQuantities[0]) {
        // Update existing quantity
        await base44.entities.InventoryQuantity.update(destQuantities[0].id, {
          quantity: (destQuantities[0].quantity || 0) + quantity
        });
      } else {
        // Create new quantity record
        await base44.entities.InventoryQuantity.create({
          price_list_item_id: priceListItemId,
          location_id: toLocationId,
          quantity: quantity,
          item_name: item.item,
          location_name: toLocation.name
        });
      }
    }

    // IDEMPOTENCY: Check if this movement already happened
    let idempotencyCheckResult = null;
    if (idempotency_key) {
      const existingMovements = await base44.entities.StockMovement.filter({
        idempotency_key: idempotency_key
      });
      if (existingMovements.length > 0) {
        // Already processed - return success without double-deducting
        return Response.json({
          success: true,
          idempotent: true,
          message: `Movement already processed (idempotency_key: ${idempotency_key})`,
          updated_quantities: []
        });
      }
    }

    // Track updated/created quantity records for response
    const updated_quantities = [];

    // Log the movement (canonical schema with reference fields)
    let referenceType = null;
    let referenceId = null;

    if (jobId) {
      referenceType = 'job';
      referenceId = jobId;
    } else if (vehicleId) {
      referenceType = 'vehicle_transfer';
      referenceId = vehicleId;
    }

    // Determine quantity IDs that were modified (for response)
    if (fromLocationId) {
      const srcQtys = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: fromLocationId
      });
      if (srcQtys[0]) {
        updated_quantities.push({
          id: srcQtys[0].id,
          location_id: fromLocationId,
          location_name: fromLocation?.name,
          new_balance: srcQtys[0].quantity - quantity
        });
      }
    }

    if (toLocationId) {
      const destQtys = await base44.entities.InventoryQuantity.filter({
        price_list_item_id: priceListItemId,
        location_id: toLocationId
      });
      if (destQtys[0]) {
        updated_quantities.push({
          id: destQtys[0].id,
          location_id: toLocationId,
          location_name: toLocation?.name,
          new_balance: (destQtys[0].quantity || 0) + quantity
        });
      }
    }

    await base44.asServiceRole.entities.StockMovement.create({
      price_list_item_id: priceListItemId,
      item_name: item.item,
      from_location_id: fromLocationId || null,
      from_location_name: fromLocation?.name || null,
      to_location_id: toLocationId || null,
      to_location_name: toLocation?.name || null,
      quantity: quantity,
      source: finalSource,
      performed_by_user_email: user.email,
      performed_by_user_name: user.full_name || user.display_name || user.email,
      performed_at: new Date().toISOString(),
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes,
      idempotency_key: idempotency_key || null
    });

    return Response.json({
      success: true,
      message: `Moved ${quantity} ${item.item} ${fromLocation ? `from ${fromLocation.name}` : ''} ${toLocation ? `to ${toLocation.name}` : ''}`,
      updated_quantities: updated_quantities
    });

  } catch (error) {
    console.error('moveInventory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});