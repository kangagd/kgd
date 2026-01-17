import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// AUTHORITATIVE DEFINITION: V2 EXECUTION (must match analyzeModelDrift.js)
const isV2Execution = (job, jobVisits) => {
  if (job?.job_model_version === 'v2') return true;
  if (typeof job?.visit_count === 'number' && job.visit_count > 0) return true;
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
    const jobsAll = await base44.asServiceRole.entities.Job.list();
    const jobs = (jobsAll || []).filter(j => !j?.deleted_at);

    // Fetch all visits
    const visitsAll = await base44.asServiceRole.entities.Visit.list();
    const visits = visitsAll || [];
    const visitsByJobId = {};
    for (const v of visits) {
      if (!v?.job_id) continue;
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    }

    let fixedCount = 0;
    const fixLog = [];
    const proposedFixes = []; // For dry run mode

    for (const job of jobs) {
      const jobVisits = visitsByJobId[job.id] || [];
      const isV2Exec = isV2Execution(job, jobVisits);
      
      if (!isV2Exec) continue; // Only fix V2 execution jobs
      
      // ONLY ALLOWED FIX: visit_count correction
      // GUARDRAIL: Do NOT modify job_model_version, legacy fields, status, or any other field
      if (jobVisits.length > 0 && job.visit_count !== jobVisits.length) {
        fixedCount++;
        
        const fixEntry = {
          job_id: job.id,
          job_number: job.job_number,
          customer_name: job.customer_name,
          old_visit_count: job.visit_count || 0,
          new_visit_count: jobVisits.length,
          visits_found: jobVisits.length
        };
        
        if (dry_run) {
          proposedFixes.push(fixEntry);
        } else {
          // SAFE WRITE: Only update visit_count, nothing else
          await base44.asServiceRole.entities.Job.update(job.id, {
            visit_count: jobVisits.length
          });
          fixLog.push(fixEntry);
        }
      }
    }

    return Response.json({
      dry_run,
      would_fix_count: dry_run ? fixedCount : undefined,
      would_fix_jobs: dry_run ? proposedFixes : undefined,
      fixed_count: !dry_run ? fixedCount : undefined,
      fixed_jobs: !dry_run ? fixLog : undefined,
      no_changes_made: dry_run,
      message: dry_run 
        ? `Dry run: ${fixedCount} jobs would have visit_count corrected (no writes performed)`
        : `Fixed ${fixedCount} jobs - visit_count synced with Visit records`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fix model drift error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});