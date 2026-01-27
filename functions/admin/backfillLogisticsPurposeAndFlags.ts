import { createClientFromRequest } from '../shared/sdk.js';
import { normalizeLogisticsPurpose } from '../shared/normalizeLogisticsPurpose.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batch_size = 50, dryRun = false, limit = null } = await req.json();

    // Find all jobs that look like logistics jobs
    const allJobs = await base44.asServiceRole.entities.Job.filter({
      $or: [
        { is_logistics_job: true },
        { logistics_purpose: { $ne: null } },
        { origin_address: { $ne: null } },
        { destination_address: { $ne: null } },
        { vehicle_id: { $ne: null } },
        { purchase_order_id: { $ne: null } },
        { third_party_trade_id: { $ne: null } }
      ]
    });

    console.log(`[backfillLogisticsPurposeAndFlags] Found ${allJobs.length} potential logistics jobs`);

    let checked = 0;
    let updated = 0;
    let purpose_fixed = 0;
    let flags_fixed = 0;
    let project_number_fixed = 0;
    const errors = [];

    // Process in batches
    for (let i = 0; i < allJobs.length; i += batch_size) {
      if (limit && checked >= limit) break;

      const batch = allJobs.slice(i, Math.min(i + batch_size, limit ? i + (limit - checked) : allJobs.length));

      for (const job of batch) {
        try {
          checked++;
          let updateData = {};
          let needsUpdate = false;

          // Fix is_logistics_job flag
          if (!job.is_logistics_job && (
            job.logistics_purpose ||
            job.origin_address ||
            job.destination_address ||
            job.vehicle_id ||
            job.purchase_order_id ||
            job.third_party_trade_id
          )) {
            updateData.is_logistics_job = true;
            needsUpdate = true;
            flags_fixed++;
            console.log(`[backfillLogisticsPurposeAndFlags] Job ${job.id}: Flagged as logistics job`);
          }

          // Fix logistics_purpose
          if (job.is_logistics_job && (!job.logistics_purpose || job.logistics_purpose === 'unknown')) {
            let normalized = null;

            // Try logistics_purpose_raw
            if (job.logistics_purpose_raw) {
              const result = normalizeLogisticsPurpose(job.logistics_purpose_raw);
              normalized = result.purpose_code;
            }

            // Try to infer from notes or legacy_notes
            if (!normalized && (job.notes || job.legacy_notes)) {
              const searchText = (job.notes || '') + ' ' + (job.legacy_notes || '');
              const result = normalizeLogisticsPurpose(searchText);
              if (result.ok) {
                normalized = result.purpose_code;
              }
            }

            // Default to "other" if still null
            if (!normalized) {
              normalized = 'other';
            }

            updateData.logistics_purpose = normalized;
            needsUpdate = true;
            purpose_fixed++;
            console.log(`[backfillLogisticsPurposeAndFlags] Job ${job.id}: Set logistics_purpose to ${normalized}`);
          }

          // Fix project_number
          if (job.is_logistics_job && job.project_id && !job.project_number) {
            try {
              const project = await base44.asServiceRole.entities.Project.get(job.project_id);
              if (project?.project_number) {
                updateData.project_number = project.project_number;
                needsUpdate = true;
                project_number_fixed++;
                console.log(`[backfillLogisticsPurposeAndFlags] Job ${job.id}: Set project_number to ${project.project_number}`);
              }
            } catch (e) {
              console.warn(`[backfillLogisticsPurposeAndFlags] Could not fetch project ${job.project_id}:`, e.message);
            }
          }

          // Apply update
          if (needsUpdate) {
            if (!dryRun) {
              await base44.asServiceRole.entities.Job.update(job.id, updateData);
            }
            updated++;
          }
        } catch (error) {
          console.error(`[backfillLogisticsPurposeAndFlags] Error processing job ${job.id}:`, error);
          errors.push({
            job_id: job.id,
            error: error.message
          });
        }
      }
    }

    const summary = {
      checked,
      updated,
      purpose_fixed,
      flags_fixed,
      project_number_fixed,
      errors,
      dryRun
    };

    console.log(`[backfillLogisticsPurposeAndFlags] Summary:`, summary);

    return Response.json({
      success: true,
      ...summary
    });

  } catch (error) {
    console.error('[backfillLogisticsPurposeAndFlags] Fatal error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});