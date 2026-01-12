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

    const updated = [];

    for (const jobId of job_ids) {
      const job = await base44.asServiceRole.entities.Job.get(jobId);
      const jobType = await base44.asServiceRole.entities.JobType.get(job.job_type_id);

      if (!jobType?.is_logistics) continue;

      let newTitle = null;

      // Material Pick Up - Warehouse
      if (jobType.name?.includes('Material Pick Up') && jobType.name?.includes('Warehouse')) {
        newTitle = `Material Pickup${job.project_name ? ` - ${job.project_name}` : ''}`;
      }
      // Material Delivery
      else if (jobType.name?.includes('Material Delivery')) {
        newTitle = `Material Delivery${job.project_name ? ` - ${job.project_name}` : ''}`;
      }
      // Supplier Pickup
      else if (jobType.name?.includes('Supplier')) {
        if (job.purchase_order_id) {
          const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
          newTitle = `Supplier Pickup${po?.supplier_name ? ` - ${po.supplier_name}` : ''}`;
        }
      }

      if (newTitle) {
        await base44.asServiceRole.entities.Job.update(jobId, {
          customer_name: newTitle
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
    console.error('[backfillLogisticsJobTitles] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});