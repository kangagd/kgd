import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to get or create supplier InventoryLocation
async function getOrCreateSupplierInventoryLocation(base44, supplier_id) {
  if (!supplier_id) throw new Error('supplier_id is required');
  
  const existing = await base44.asServiceRole.entities.InventoryLocation.filter({
    type: 'supplier',
    supplier_id: supplier_id
  });
  
  if (existing.length > 0) return existing[0];
  
  let supplierName = 'Supplier';
  try {
    const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
    if (supplier) supplierName = supplier.name || 'Supplier';
  } catch (err) {
    console.warn(`Failed to fetch supplier ${supplier_id}:`, err);
  }
  
  return await base44.asServiceRole.entities.InventoryLocation.create({
    name: supplierName,
    type: 'supplier',
    supplier_id: supplier_id,
    is_active: true
  });
} 

// Suppliers have unlimited stock - no validation needed when source is supplier
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // AUTH GUARDRAIL: Enforce permissions for transfer recording
    const isAdmin = user.role === 'admin';
    const isManager = user.extended_role === 'manager';
    const isTechnician = user.is_field_technician === true || user.extended_role === 'technician';
    
    if (!isAdmin && !isManager && !isTechnician) {
      return Response.json({ error: 'Forbidden: Only admin, manager, or technician can record transfers' }, { status: 403 });
    }
    
    // TECHNICIAN CONSTRAINT: Limit to vehicle ↔ warehouse transfers only
    if (isTechnician && !isAdmin && !isManager) {
      // Get technician's vehicle and vehicle inventory location
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({
        assigned_user_id: user.id,
        is_active: true
      });
      
      if (vehicles.length !== 1) {
        return Response.json({ 
          error: 'Technician must have exactly one active assigned vehicle to transfer stock' 
        }, { status: 403 });
      }
      
      const techVehicle = vehicles[0];
      const vehicleLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: techVehicle.id
      });
      
      if (vehicleLocations.length === 0) {
        return Response.json({ 
          error: 'Vehicle has no inventory location configured' 
        }, { status: 400 });
      }
    }

    const { job_id, source_location_id, destination_location_id, items, notes } = await req.json();

    let finalSourceLocationId = source_location_id;

    if (!job_id || !destination_location_id || !items || items.length === 0) {
      return Response.json({ error: 'Missing required fields (job_id, destination_location_id, items)' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // IDEMPOTENCY: If transfer already completed, return success without duplication
    if (job.stock_transfer_status === 'completed') {
      return Response.json({
        success: true,
        message: 'Transfer already completed for this logistics job',
        batch_id: job.linked_stock_movement_batch_id,
        items_transferred: 0,
        already_completed: true
      });
    }

    if (!finalSourceLocationId && job.purchase_order_id) {
        try {
            const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
            if (po && po.supplier_id) {
                const supplierLocation = await getOrCreateSupplierInventoryLocation(base44, po.supplier_id);
                finalSourceLocationId = supplierLocation.id;
            }
        } catch (err) {
            console.error(`Failed to find fallback source location for job ${job_id}:`, err);
        }
    }

    if (!finalSourceLocationId) {
        return Response.json({ error: 'Missing source location. Set PO supplier or create supplier InventoryLocation.' }, { status: 400 });
    }

    // Fetch locations
    const sourceLocation = await base44.asServiceRole.entities.InventoryLocation.get(finalSourceLocationId);
    const destLocation = await base44.asServiceRole.entities.InventoryLocation.get(destination_location_id);

    if (!sourceLocation || !destLocation) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    // CRITICAL: Suppliers have unlimited stock - skip validation for supplier sources
    // Check if source is a supplier location (either by type or by supplier_id field)
    const isSupplierSource = sourceLocation.type === 'supplier' || sourceLocation.supplier_id;
    
    console.log(`[Transfer DEBUG] Source: ${sourceLocation.name}, type: ${sourceLocation.type}, supplier_id: ${sourceLocation.supplier_id}, isSupplierSource: ${isSupplierSource}`);

    // GUARDRAIL: Validate ALL items BEFORE executing any transfers (transaction-like pattern)
    const validationErrors = [];
    const itemsToProcess = [];

    // PHASE 1: Validate all items and prepare operations
    for (const item of items) {
      let { price_list_item_id, quantity, part_id } = item;
      
      // Ensure quantity is a positive number
      quantity = parseFloat(quantity) || 0;
      if (quantity <= 0) {
        validationErrors.push('Item quantity must be greater than 0');
        continue;
      }
      
      // Support both price_list_item_id and part_id (fallback for parts created from PO lines)
      const itemId = price_list_item_id || part_id;
      
      if (!itemId) {
        validationErrors.push('Item missing price_list_item_id or part_id');
        continue;
      }

      // Try to get item name for better error messages
      let itemName = 'Unknown Item';
      
      // Try price list first if available
      if (price_list_item_id) {
        try {
          const priceItem = await base44.asServiceRole.entities.PriceListItem.get(price_list_item_id);
          if (priceItem) {
            itemName = priceItem.item || 'Unknown Item';
          }
        } catch (err) {
          // Continue with generic name
        }
      } else if (part_id) {
        // Fallback to part's item_name
        try {
          const part = await base44.asServiceRole.entities.Part.get(part_id);
          if (part) {
            itemName = part.item_name || 'Unknown Item';
          }
        } catch (err) {
          // Continue with generic name
        }
      }

      // SKIP ALL VALIDATION FOR SUPPLIER SOURCES - they have unlimited stock
      if (isSupplierSource) {
        itemsToProcess.push({
          itemId: itemId,
          price_list_item_id: itemId,
          quantity,
          itemName,
          sourceQtyRecord: null
        });
        continue;
      }
      
      // Validate stock availability for non-supplier sources only
      const sourceQty = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id: itemId,
        location_id: finalSourceLocationId
      });

      const currentQty = sourceQty[0]?.quantity || 0;
      if (currentQty < quantity) {
        validationErrors.push(`${itemName}: Insufficient stock. Available: ${currentQty}, Requested: ${quantity}`);
        continue;
      }

      itemsToProcess.push({
        itemId: itemId,
        price_list_item_id: itemId,
        quantity,
        itemName,
        sourceQtyRecord: sourceQty[0]
      });
    }

    // GUARDRAIL: If ANY validation failed, abort BEFORE making changes
    if (validationErrors.length > 0) {
      return Response.json({
        error: `Transfer validation failed:\n${validationErrors.join('\n')}`,
        validation_errors: validationErrors
      }, { status: 400 });
    }

    // PHASE 2: Execute all transfers (validation passed)
    // Use asServiceRole to bypass RLS restrictions on entity create/update
    let itemsTransferred = 0;
    const batchId = `logistics_job_${job_id}_${Date.now()}`;
    const stockMovementIds = [];

    for (const item of itemsToProcess) {
      const { price_list_item_id, quantity, itemName, sourceQtyRecord } = item;

      // Deduct from source (if not supplier)
      if (!isSupplierSource && sourceQtyRecord) {
        await base44.asServiceRole.entities.InventoryQuantity.update(sourceQtyRecord.id, {
          quantity: sourceQtyRecord.quantity - quantity
        });
      }

      // Add to destination
      const destQty = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id,
        location_id: destination_location_id
      });

      if (destQty[0]) {
        await base44.asServiceRole.entities.InventoryQuantity.update(destQty[0].id, {
          quantity: (destQty[0].quantity || 0) + quantity
        });
      } else {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id,
          location_id: destination_location_id,
          quantity: quantity,
          item_name: itemName,
          location_name: destLocation.name
        });
      }

      // Create StockMovement record (canonical schema with job reference)
      // Only decrement supplier location if NOT a supplier source (unlimited stock)
      let finalFromLocationId = isSupplierSource ? null : finalSourceLocationId;
      
      const movement = await base44.asServiceRole.entities.StockMovement.create({
        price_list_item_id: price_list_item_id,
        item_name: itemName,
        quantity: quantity,
        from_location_id: finalFromLocationId,
        from_location_name: isSupplierSource ? sourceLocation.name : sourceLocation.name,
        to_location_id: destination_location_id,
        to_location_name: destLocation.name,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: new Date().toISOString(),
        source: 'logistics_job_completion',
        reference_type: 'job',
        reference_id: job.id,
        notes: notes ? `Job #${job.job_number}: ${notes}` : null
      });

      stockMovementIds.push(movement.id);
      itemsTransferred++;
    }

    // Update job status
    await base44.asServiceRole.entities.Job.update(job_id, {
      stock_transfer_status: 'completed',
      linked_stock_movement_batch_id: batchId
    });

    return Response.json({
      success: true,
      items_transferred: itemsTransferred,
      batch_id: batchId,
      stock_movement_ids: stockMovementIds,
      message: `Transferred ${itemsTransferred} item(s) from ${sourceLocation.name} to ${destLocation.name}`
    });
  } catch (error) {
    console.error('Record transfer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});