import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getOrCreateSupplierInventoryLocation } from './shared/supplierLocationHelper.js';

// Suppliers have unlimited stock - no validation needed when source is supplier
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
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

    // CRITICAL: Suppliers have unlimited stock - skip validation for supplier type
    const isSupplierSource = sourceLocation.type === 'supplier';

    // Process each item
    let itemsTransferred = 0;
    const batchId = `logistics_job_${job_id}_${Date.now()}`;
    const stockMovementIds = [];

    for (const item of items) {
      const { price_list_item_id, quantity } = item;

      // Get item name
      const priceItem = await base44.asServiceRole.entities.PriceListItem.get(price_list_item_id);
      const itemName = priceItem?.item || 'Unknown Item';

      // Supplier sources: unlimited stock, no validation or deduction
      // Non-supplier sources: validate and deduct from inventory
      if (!isSupplierSource) {
        const sourceQty = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id,
          location_id: finalSourceLocationId
        });

        const currentQty = sourceQty[0]?.quantity || 0;
        if (currentQty < quantity) {
          return Response.json({
            error: `Insufficient stock at ${sourceLocation.name}. Available: ${currentQty}, Requested: ${quantity}`
          }, { status: 400 });
        }

        // Deduct from source
        await base44.asServiceRole.entities.InventoryQuantity.update(sourceQty[0].id, {
          quantity: currentQty - quantity
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

      // Create StockMovement record (canonical schema)
      const movement = await base44.asServiceRole.entities.StockMovement.create({
        price_list_item_id: price_list_item_id,
        item_name: itemName,
        quantity: quantity,
        from_location_id: finalSourceLocationId,
        from_location_name: sourceLocation.name,
        to_location_id: destination_location_id,
        to_location_name: destLocation.name,
        performed_by_user_email: user.email,
        performed_by_user_name: user.full_name || user.display_name || user.email,
        performed_at: new Date().toISOString(),
        source: 'logistics_job',
        reference_type: 'job',
        reference_id: job_id,
        notes: notes ? `Job #${job.job_number}: ${notes}` : `Transferred via Logistics Job #${job.job_number}`
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