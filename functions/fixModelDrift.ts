import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Check if job is V2 enabled
const isJobV2Enabled = (job) => {
  const CUTOFF_DATE = new Date('2026-01-16T00:00:00Z');
  const jobCreated = job.created_date ? new Date(job.created_date) : null;
  
  if (job.job_model_version === 'v2') return true;
  if (job.job_model_version === 'v1') return false;
  if (job.visit_count && job.visit_count > 0) return true;
  if (jobCreated && jobCreated >= CUTOFF_DATE) return true;
  
  return false;
};

// Helper: Detect legacy fields
const detectLegacyFields = (job) => {
  const legacyFields = [];
  const fieldsToCheck = [
    'overview', 'next_steps', 'communication_with_client', 
    'pricing_provided', 'additional_info', 'completion_notes'
  ];
  
  for (const field of fieldsToCheck) {
    if (job[field]) {
      legacyFields.push(field);
    }
  }
  
  return legacyFields;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY: Verify user is admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { dry_run = true } = await req.json();

    // Fetch all non-deleted jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      deleted_at: { $exists: false } 
    });

    // Fetch all visits
    const visits = await base44.asServiceRole.entities.Visit.list();
    const visitsByJobId = {};
    visits.forEach(v => {
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    });

    let fixedCount = 0;
    const fixLog = [];

    for (const job of jobs) {
      const isV2 = isJobV2Enabled(job);
      if (!isV2) continue; // Only fix V2 jobs
      
      const legacyFields = detectLegacyFields(job);
      const jobVisits = visitsByJobId[job.id] || [];
      let jobNeedsFix = false;
      const jobFixes = [];

      // Fix Type 1: Sync visit_count with actual Visit records
      if (jobVisits.length > 0 && job.visit_count !== jobVisits.length) {
        jobNeedsFix = true;
        jobFixes.push(`visit_count: ${job.visit_count || 0} → ${jobVisits.length}`);
        if (!dry_run) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            visit_count: jobVisits.length
          });
        }
      }

      // Fix Type 2: Mark as v2 explicitly if not already
      if (!job.job_model_version || job.job_model_version !== 'v2') {
        jobNeedsFix = true;
        jobFixes.push(`job_model_version: ${job.job_model_version || 'null'} → v2`);
        if (!dry_run) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            job_model_version: 'v2'
          });
        }
      }

      // Fix Type 3: Clear legacy fields if visits exist (data should be in Visit records)
      if (legacyFields.length > 0 && jobVisits.length > 0) {
        jobNeedsFix = true;
        jobFixes.push(`Clear ${legacyFields.length} legacy fields: ${legacyFields.join(', ')}`);
        if (!dry_run) {
          const clearData = {};
          legacyFields.forEach(field => {
            clearData[field] = null;
          });
          await base44.asServiceRole.entities.Job.update(job.id, clearData);
        }
      }

      if (jobNeedsFix) {
        fixedCount++;
        fixLog.push({
          job_id: job.id,
          job_number: job.job_number,
          fixes: jobFixes
        });
      }
    }

    return Response.json({
      dry_run,
      fixed_count: fixedCount,
      fixes_applied: fixLog.slice(0, 20), // First 20 for preview
      message: dry_run 
        ? `Dry run complete: ${fixedCount} jobs would be fixed (no changes made)`
        : `Successfully fixed ${fixedCount} jobs`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fix model drift error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});