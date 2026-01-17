import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dryRun = true } = await req.json();

    // Find logistics jobs without new fields
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      is_logistics_job: true
    });

    const jobsToMigrate = allJobs.filter(job => 
      !job.source_location_id || !job.destination_location_id || !job.reference_type
    );

    // Fetch locations for mapping
    const locations = await base44.asServiceRole.entities.InventoryLocation.filter({});
    const mainWarehouse = locations.find(l => l.type === 'warehouse' && l.name?.toLowerCase().includes('main'));

    const migrationResults = [];

    for (const job of jobsToMigrate) {
      const result = {
        job_id: job.id,
        job_number: job.job_number,
        changes: {},
        notes: []
      };

      // Infer reference_type and reference_id
      if (!job.reference_type) {
        if (job.purchase_order_id) {
          result.changes.reference_type = 'purchase_order';
          result.changes.reference_id = job.purchase_order_id;
          result.notes.push('Inferred from purchase_order_id');
        } else if (job.project_id) {
          result.changes.reference_type = 'project';
          result.changes.reference_id = job.project_id;
          result.notes.push('Inferred from project_id');
        } else if (job.sample_ids?.length > 0) {
          result.changes.reference_type = 'sample_logistics';
          result.changes.reference_id = job.sample_ids[0];
          result.notes.push('Inferred from sample_ids');
        } else {
          result.changes.reference_type = 'manual';
          result.notes.push('No linked entity found; marked as manual');
        }
      }

      // Map location IDs based on logistics purpose
      if (!job.source_location_id || !job.destination_location_id) {
        if (job.logistics_purpose === 'po_delivery_to_warehouse' && mainWarehouse) {
          result.changes.destination_location_id = mainWarehouse.id;
          result.notes.push('Mapped warehouse delivery: destination = Main Warehouse');
        } else if (job.logistics_purpose === 'po_pickup_from_supplier') {
          result.notes.push('Supplier pickup: source/destination require manual mapping');
        } else if (job.logistics_purpose === 'part_pickup_for_install' && job.vehicle_id) {
          const vehicleLocation = locations.find(l => l.type === 'vehicle' && l.vehicle_id === job.vehicle_id);
          if (vehicleLocation) {
            result.changes.destination_location_id = vehicleLocation.id;
            result.notes.push(`Mapped vehicle movement: destination = ${vehicleLocation.name}`);
          }
        }
      }

      // Mark as legacy
      result.changes.legacy_flag = true;
      result.changes.legacy_notes = result.notes.join('; ');
      result.changes.stock_transfer_status = job.logistics_outcome === 'none' ? 'not_started' : 'pending';

      migrationResults.push(result);

      // Apply changes if not dryRun
      if (!dryRun && Object.keys(result.changes).length > 0) {
        await base44.asServiceRole.entities.Job.update(job.id, result.changes);
      }
    }

    return Response.json({
      success: true,
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      jobs_to_migrate: migrationResults.length,
      results: migrationResults,
      message: dryRun 
        ? `${migrationResults.length} jobs would be migrated (dry run)`
        : `${migrationResults.length} jobs migrated successfully`
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});