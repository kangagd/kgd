import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Canonical job types to keep (by name)
    const KEPT_JOB_TYPES = {
      'Delivery in Loading Bay': '695c6152f4ca18dd90b07127',
      'Ready for Pick Up - Supplier': '695c6152f4ca18dd90b07128',
      'Material Pick Up - Warehouse': '695c6152f4ca18dd90b07129', // primary
      'Material Drop Off - Client': '695c6152f4ca18dd90b0712a',
      'Sample Drop-Off': '695358f790a7e6532a22ff13',
      'Sample Pickup': '69535bb98c0aea9874f02773'
    };

    // Map logistics_purpose to canonical job type
    const PURPOSE_TO_JOB_TYPE = {
      'po_delivery_to_warehouse': KEPT_JOB_TYPES['Delivery in Loading Bay'],
      'po_pickup_from_supplier': KEPT_JOB_TYPES['Ready for Pick Up - Supplier'],
      'part_pickup_for_install': KEPT_JOB_TYPES['Material Pick Up - Warehouse'],
      'manual_client_dropoff': KEPT_JOB_TYPES['Material Drop Off - Client'],
      'sample_dropoff': KEPT_JOB_TYPES['Sample Drop-Off'],
      'sample_pickup': KEPT_JOB_TYPES['Sample Pickup']
    };

    // Get all logistics jobs
    const logisticsJobs = await base44.asServiceRole.entities.Job.filter({ 
      is_logistics_job: true 
    });

    let updated = 0;
    const errors = [];

    for (const job of logisticsJobs) {
      try {
        let targetJobTypeId = null;
        let targetJobTypeName = null;

        // Determine target job type based on logistics_purpose
        if (job.logistics_purpose && PURPOSE_TO_JOB_TYPE[job.logistics_purpose]) {
          targetJobTypeId = PURPOSE_TO_JOB_TYPE[job.logistics_purpose];
          targetJobTypeName = Object.keys(KEPT_JOB_TYPES).find(
            key => KEPT_JOB_TYPES[key] === targetJobTypeId
          );
        } else {
          // Fallback: try to infer from job_type_id or default to generic pickup
          const currentJobType = job.job_type_id;
          
          // Check if already using a kept job type
          if (Object.values(KEPT_JOB_TYPES).includes(currentJobType)) {
            continue; // Already correct
          }

          // Default fallback based on purchase_order_id presence
          if (job.purchase_order_id) {
            targetJobTypeId = KEPT_JOB_TYPES['Ready for Pick Up - Supplier'];
            targetJobTypeName = 'Ready for Pick Up - Supplier';
          } else {
            targetJobTypeId = KEPT_JOB_TYPES['Material Pick Up - Warehouse'];
            targetJobTypeName = 'Material Pick Up - Warehouse';
          }
        }

        // Update job if job_type_id changed
        if (targetJobTypeId && job.job_type_id !== targetJobTypeId) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            job_type_id: targetJobTypeId,
            job_type_name: targetJobTypeName
          });
          updated++;
        }
      } catch (error) {
        errors.push({ job_id: job.id, error: error.message });
      }
    }

    // Now delete deprecated job types
    const allJobTypes = await base44.asServiceRole.entities.JobType.filter({ 
      is_logistics: true 
    });

    const toDelete = allJobTypes.filter(jt => 
      !Object.values(KEPT_JOB_TYPES).includes(jt.id)
    );

    let deleted = 0;
    for (const jobType of toDelete) {
      try {
        await base44.asServiceRole.entities.JobType.delete(jobType.id);
        deleted++;
      } catch (error) {
        errors.push({ job_type_id: jobType.id, name: jobType.name, error: error.message });
      }
    }

    return Response.json({
      success: true,
      jobs_updated: updated,
      job_types_deleted: deleted,
      total_logistics_jobs: logisticsJobs.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error migrating logistics job types:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});