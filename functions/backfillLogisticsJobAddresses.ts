import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const { job_ids } = bodyText ? JSON.parse(bodyText) : {};

    if (!job_ids || !Array.isArray(job_ids)) {
      return Response.json({ error: 'job_ids array required' }, { status: 400 });
    }

    // Fetch warehouse location
    const warehouseLocations = await base44.asServiceRole.entities.InventoryLocation.filter({
      type: 'warehouse',
      is_active: true
    });
    
    const warehouse = warehouseLocations[0];
    if (!warehouse) {
      return Response.json({ error: 'No active warehouse found' }, { status: 404 });
    }

    const updated = [];

    for (const jobId of job_ids) {
      const job = await base44.asServiceRole.entities.Job.get(jobId);
      const jobType = await base44.asServiceRole.entities.JobType.get(job.job_type_id);

      if (!jobType?.is_logistics) continue;

      let newAddress = null;

      // Material Pick Up - Warehouse → use warehouse address
      if (jobType.name?.includes('Material Pick Up') && jobType.name?.includes('Warehouse')) {
        newAddress = warehouse.address || warehouse.name || 'Main Warehouse';
      }
      // Material Delivery - use project/job address (no change)
      // Supplier Pickup - use supplier address (handled elsewhere)

      if (newAddress && newAddress !== job.address) {
        await base44.asServiceRole.entities.Job.update(jobId, {
          address: newAddress,
          address_full: newAddress
        });
        updated.push(jobId);
      }
    }

    return Response.json({
      success: true,
      updated_count: updated.length,
      updated_job_ids: updated
    });
  } catch (error) {
    console.error('[backfillLogisticsJobAddresses] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});