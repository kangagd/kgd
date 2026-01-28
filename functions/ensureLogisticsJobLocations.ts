import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Ensure logistics job has from_location_id and to_location_id
 * Infers missing values based on job purpose, PO, vehicle, etc.
 * NEVER overwrites existing user-set values.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.is_logistics_job) {
      return Response.json({ 
        error: 'Job is not a logistics job' 
      }, { status: 400 });
    }

    let fromLocationId = job.source_location_id;
    let toLocationId = job.destination_location_id;
    let updated = false;
    let inferredReason = [];

    // Get all locations for inference
    const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
    const warehouse = allLocations.find(l => l.type === 'Warehouse' && l.name?.toLowerCase().includes('main'));
    const loadingBay = allLocations.find(l => l.type === 'Loading Bay');
    const storage = allLocations.find(l => l.type === 'Storage');

    // Infer FROM location if missing
    if (!fromLocationId) {
      if (job.logistics_purpose === 'po_pickup_from_supplier' && job.purchase_order_id) {
        // Get supplier location from PO
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
        if (po?.supplier_id) {
          const supplierLocations = allLocations.filter(l => 
            l.type === 'Supplier' && l.supplier_id === po.supplier_id
          );
          if (supplierLocations.length > 0) {
            fromLocationId = supplierLocations[0].id;
            inferredReason.push('from=supplier location');
          }
        }
      } else if (job.logistics_purpose === 'po_delivery_to_warehouse') {
        // Delivery starts from loading bay
        if (loadingBay) {
          fromLocationId = loadingBay.id;
          inferredReason.push('from=loading bay (delivery)');
        }
      }
    }

    // Infer TO location if missing
    if (!toLocationId) {
      if (job.vehicle_id) {
        // If vehicle assigned, destination is vehicle
        const vehicleLocation = allLocations.find(l => 
          l.type === 'Vehicle' && l.vehicle_id === job.vehicle_id
        );
        if (vehicleLocation) {
          toLocationId = vehicleLocation.id;
          inferredReason.push('to=vehicle location');
        }
      } else if (job.logistics_purpose === 'po_delivery_to_warehouse' || 
                 job.logistics_purpose === 'po_pickup_from_supplier') {
        // Default destination is storage/warehouse
        const targetLocation = storage || warehouse;
        if (targetLocation) {
          toLocationId = targetLocation.id;
          inferredReason.push('to=storage/warehouse');
        }
      }
    }

    // Update job if we inferred any values
    if ((fromLocationId && fromLocationId !== job.source_location_id) ||
        (toLocationId && toLocationId !== job.destination_location_id)) {
      
      const updateData = {};
      if (fromLocationId && !job.source_location_id) {
        updateData.source_location_id = fromLocationId;
      }
      if (toLocationId && !job.destination_location_id) {
        updateData.destination_location_id = toLocationId;
      }

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.Job.update(job_id, updateData);
        updated = true;
      }
    }

    const needsManual = !fromLocationId || !toLocationId;

    return Response.json({
      success: true,
      updated,
      needs_manual: needsManual,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      inferred_reason: inferredReason.join(', ') || null
    });

  } catch (error) {
    console.error('[ensureLogisticsJobLocations ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});