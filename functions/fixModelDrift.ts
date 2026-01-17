import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// AUTHORITATIVE DEFINITION: V2 EXECUTION (must match analyzeModelDrift.js)
const isV2Execution = (job, jobVisits) => {
  if (job.job_model_version === 'v2') return true;
  if (job.visit_count && job.visit_count > 0) return true;
  if (jobVisits && jobVisits.length > 0) return true;
  return false;
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

    // GUARDRAIL: Require feature flag for commit mode (writes)
    if (!dry_run) {
      // Check if model health fixes are enabled
      const modelHealthEnabled = Deno.env.get('FEATURE_MODEL_HEALTH_FIXES') === 'true';
      if (!modelHealthEnabled) {
        return Response.json({ 
          error: 'Model Health fixes are disabled. Enable FEATURE_MODEL_HEALTH_FIXES to commit changes.' 
        }, { status: 403 });
      }
    }

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
    const proposedFixes = []; // For dry run mode

    for (const job of jobs) {
      const jobVisits = visitsByJobId[job.id] || [];
      const isV2Exec = isV2Execution(job, jobVisits);
      
      if (!isV2Exec) continue; // Only fix V2 execution jobs
      
      let jobNeedsFix = false;
      const jobFixes = [];

      // ONLY FIXABLE DRIFT: Sync visit_count with actual Visit records
      if (jobVisits.length > 0 && job.visit_count !== jobVisits.length) {
        jobNeedsFix = true;
        jobFixes.push(`visit_count: ${job.visit_count || 0} → ${jobVisits.length}`);
        if (!dry_run) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            visit_count: jobVisits.length
          });
        }
      }

      // SAFE FIX: Mark as v2 explicitly if visits exist but not marked
      if (jobVisits.length > 0 && job.job_model_version !== 'v2') {
        jobNeedsFix = true;
        jobFixes.push(`job_model_version: ${job.job_model_version || 'null'} → v2`);
        if (!dry_run) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            job_model_version: 'v2'
          });
        }
      }

      // GUARDRAIL: Do NOT clear legacy fields - migration not implemented
      // This would be data loss without proper Visit migration

      if (jobNeedsFix) {
        fixedCount++;
        const fixEntry = {
          job_id: job.id,
          job_number: job.job_number,
          customer_name: job.customer_name,
          fixes: jobFixes
        };
        
        if (dry_run) {
          proposedFixes.push(fixEntry);
        } else {
          fixLog.push(fixEntry);
        }
      }
    }

    return Response.json({
      dry_run,
      fixed_count: fixedCount,
      proposed_fixes: dry_run ? proposedFixes.slice(0, 20) : undefined, // For dry run
      fixes_applied: !dry_run ? fixLog.slice(0, 20) : undefined, // For commit
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