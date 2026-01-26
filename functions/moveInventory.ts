import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CANONICAL INVENTORY WRITE PATH
 *
 * InventoryQuantity is the SINGLE source of truth for on-hand stock.
 * This function is one of the ONLY allowed writers.
 *
 * Rules:
 * - Every InventoryQuantity mutation MUST create a StockMovement record
 * - StockMovement is immutable (audit ledger)
 * - UI components must NEVER write InventoryQuantity directly
 * - recordStockMovement MUST NOT mutate inventory
 *
 * Approved writers:
 * - receivePoItems        (PO receipts)
 * - moveInventory         (location transfers) ← THIS FUNCTION
 * - adjustStockCorrection (admin corrections)
 * - autoDeductJobUsage    (job consumption)
 * - seedBaselineStock     (day-0 initialization)
 */
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
      source = 'transfer',
      notes = null 
    } = body;

    if (!priceListItemId || !quantity || quantity <= 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // moveInventory is transfer-only: reject any other source
    if (source !== 'transfer') {
      return Response.json(
        { 
          error: 'moveInventory only supports source="transfer". For PO receipt, use receivePoItems. For admin correction, use adjustStockCorrection. For job usage, use autoDeductJobUsage.' 
        }, 
        { status: 400 }
      );
    }

    // Transfers require both from and to locations
    if (!fromLocationId || !toLocationId) {
      return Response.json({ error: 'Transfer requires both source and destination locations' }, { status: 400 });
    }

    // TECHNICIAN AUTHORIZATION: enforce warehouse <-> own vehicle only
    if (user.role === 'technician') {
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

    // Get item details
    const item = await base44.entities.PriceListItem.get(priceListItemId);
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
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

    // Log the movement (canonical schema) - no reference for pure transfers
    const referenceType = null;
    const referenceId = null;

    await base44.entities.StockMovement.create({
      price_list_item_id: priceListItemId,
      item_name: item.item,
      from_location_id: fromLocationId,
      from_location_name: fromLocation?.name || null,
      to_location_id: toLocationId,
      to_location_name: toLocation?.name || null,
      quantity: quantity,
      source: 'transfer',
      performed_by_user_email: user.email,
      performed_by_user_name: user.full_name || user.display_name || user.email,
      performed_at: new Date().toISOString(),
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes
    });

    return Response.json({
      success: true,
      message: `Moved ${quantity} ${item.item} ${fromLocation ? `from ${fromLocation.name}` : ''} ${toLocation ? `to ${toLocation.name}` : ''}`
    });

  } catch (error) {
    console.error('moveInventory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});