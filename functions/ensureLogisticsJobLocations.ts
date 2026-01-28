import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ensureLogisticsJobLocations
 * 
 * Ensures a logistics job has from/to location IDs set.
 * Infers missing locations based on job context (logistics_purpose, PO, etc.)
 * Does NOT overwrite existing user-set locations.
 * 
 * Input: { job_id: string }
 * Output: { 
 *   updated: boolean, 
 *   needs_manual: boolean, 
 *   from_location_id: string|null, 
 *   to_location_id: string|null 
 * }
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

    // Load job
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.is_logistics_job) {
      return Response.json({
        error: 'Job is not a logistics job',
        needs_manual: false
      }, { status: 400 });
    }

    let fromLocationId = job.source_location_id;
    let toLocationId = job.destination_location_id;
    let updated = false;
    let needsManual = false;

    // If both already set, nothing to do
    if (fromLocationId && toLocationId) {
      return Response.json({
        updated: false,
        needs_manual: false,
        from_location_id: fromLocationId,
        to_location_id: toLocationId
      });
    }

    // Infer missing locations
    const updateData = {};

    // Infer FROM location
    if (!fromLocationId) {
      if (job.logistics_purpose === 'po_pickup_from_supplier' || job.logistics_purpose === 'po_delivery_to_warehouse') {
        // Get supplier location from PO
        if (job.purchase_order_id) {
          const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
          if (po?.supplier_id) {
            const supplierLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
              type: 'supplier',
              supplier_id: po.supplier_id,
              is_active: true
            });
            if (supplierLocs.length > 0) {
              fromLocationId = supplierLocs[0].id;
              updateData.source_location_id = fromLocationId;
              updated = true;
            }
          }
        }
      } else if (job.logistics_purpose === 'part_pickup_for_install') {
        // Default to main warehouse
        const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
          type: 'warehouse',
          is_active: true
        });
        if (warehouses.length > 0) {
          fromLocationId = warehouses[0].id;
          updateData.source_location_id = fromLocationId;
          updated = true;
        }
      }

      if (!fromLocationId) {
        needsManual = true;
      }
    }

    // Infer TO location
    if (!toLocationId) {
      if (job.logistics_purpose === 'po_delivery_to_warehouse' || job.logistics_purpose === 'po_pickup_from_supplier') {
        // Default to main warehouse
        const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
          type: 'warehouse',
          is_active: true
        });
        if (warehouses.length > 0) {
          toLocationId = warehouses[0].id;
          updateData.destination_location_id = toLocationId;
          updated = true;
        }
      } else if (job.logistics_purpose === 'part_pickup_for_install') {
        // Use assigned vehicle if available
        if (job.vehicle_id) {
          const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
            type: 'vehicle',
            vehicle_id: job.vehicle_id,
            is_active: true
          });
          if (vehicleLocs.length > 0) {
            toLocationId = vehicleLocs[0].id;
            updateData.destination_location_id = toLocationId;
            updated = true;
          }
        }
      }

      if (!toLocationId) {
        needsManual = true;
      }
    }

    // Update job if we inferred any locations
    if (updated && Object.keys(updateData).length > 0) {
      await base44.asServiceRole.entities.Job.update(job_id, updateData);
    }

    return Response.json({
      updated,
      needs_manual: needsManual,
      from_location_id: fromLocationId,
      to_location_id: toLocationId
    });

  } catch (error) {
    console.error('[ensureLogisticsJobLocations] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});