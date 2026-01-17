import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// AUTHORITATIVE DEFINITION: V2 EXECUTION
// A job is V2 execution if ANY is true:
// 1. job_model_version === 'v2'
// 2. visit_count > 0
// 3. Has Visit records in database
const isV2Execution = (job, jobVisits) => {
  if (job?.job_model_version === 'v2') return true;
  if (typeof job?.visit_count === 'number' && job.visit_count > 0) return true;
  if (jobVisits && jobVisits.length > 0) return true;
  return false;
};

// Helper: Detect legacy execution fields on Job record
const detectLegacyFields = (job) => {
  const legacyFields = [];
  const fieldsToCheck = [
    'overview', 'next_steps', 'communication_with_client',
    'pricing_provided', 'additional_info', 'completion_notes'
  ];

  for (const field of fieldsToCheck) {
    const v = job?.[field];
    if (v && typeof v === 'string' && v.trim() && v !== '<p><br></p>') {
      legacyFields.push(field);
    }
  }

  return legacyFields;
};

// Helper: Check if legacy sections should be hidden (for UI)
const shouldHideLegacySections = (job) => {
  // Only hide if has execution (visit_count > 0)
  if (typeof job?.visit_count === 'number' && job.visit_count > 0) return true;
  return false;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all non-deleted jobs
    const jobsAll = await base44.asServiceRole.entities.Job.list();
    const jobs = (jobsAll || []).filter(j => !j?.deleted_at);

    // Fetch all visits
    const visitsAll = await base44.asServiceRole.entities.Visit.list();
    const visits = visitsAll || [];

    // Index visits by job_id
    const visitsByJobId = {};
    for (const v of visits) {
      const jid = v?.job_id;
      if (!jid) continue;
      if (!visitsByJobId[jid]) visitsByJobId[jid] = [];
      visitsByJobId[jid].push(v);
    }

    // Analysis
    let v2ExecutionCount = 0;
    let v1LegacyCount = 0;
    const issuesByType = {};

    for (const job of jobs) {
      const jobVisits = visitsByJobId[job.id] || [];
      const isV2Exec = isV2Execution(job, jobVisits);
      const shouldHide = shouldHideLegacySections(job);
      const legacyFields = detectLegacyFields(job);

      if (isV2Exec) v2ExecutionCount++;

      // FIXABLE DRIFT 1: visit_count mismatch
      if (isV2Exec && jobVisits.length > 0 && job.visit_count !== jobVisits.length) {
        const issueType = 'visit_count_mismatch';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'V2 execution jobs with Visit records but visit_count does not match actual count',
            severity: 'error',
            fixable: true,
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count || 0,
            actual_visits: jobVisits.length,
            job_model_version: job.job_model_version || 'detected',
            status: job.status,
            issue_details: `visit_count=${job.visit_count || 0} → should be ${jobVisits.length}`
          });
        }
      }

      // FIXABLE DRIFT 2: V2 execution with legacy fields (migration not yet implemented)
      if (isV2Exec && legacyFields.length > 0 && (shouldHide || job.status === 'Completed')) {
        const issueType = 'v2_execution_with_legacy_fields';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'V2 execution jobs with legacy data in Job record (should be migrated to Visit)',
            severity: 'warn',
            fixable: false,
            fix_blocked_reason: 'migration_not_implemented',
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count || 0,
            actual_visits: jobVisits.length,
            job_model_version: job.job_model_version || 'detected',
            status: job.status,
            issue_details: `${legacyFields.length} legacy fields: ${legacyFields.join(', ')}`
          });
        }
      }

      // FIXABLE DRIFT 3: visit_count > 0 but no Visit records (data loss warning)
      if (isV2Exec && (job.visit_count || 0) > 0 && jobVisits.length === 0) {
        const issueType = 'missing_visit_records';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'Jobs with visit_count > 0 but no Visit records (potential data loss)',
            severity: 'error',
            fixable: false,
            fix_blocked_reason: 'data_loss_cannot_recreate',
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count || 0,
            actual_visits: 0,
            job_model_version: job.job_model_version || 'detected',
            status: job.status,
            issue_details: `visit_count=${job.visit_count} but no Visit records (investigate)`
          });
        }
      }

      // NON-FIXABLE LEGACY (informational): V1 jobs with legacy fields
      if (!isV2Exec && legacyFields.length > 0) {
        v1LegacyCount++;
        const issueType = 'v1_with_legacy_fields';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'V1 jobs with legacy execution data (expected behavior - informational only)',
            severity: 'info',
            fixable: false,
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count || 0,
            actual_visits: jobVisits.length,
            job_model_version: job.job_model_version || 'v1',
            status: job.status,
            issue_details: `${legacyFields.length} legacy fields (normal for v1)`
          });
        }
      }
    }

    // Count only FIXABLE drift for health score
    const fixableDriftCount = Object.values(issuesByType)
      .filter(issue => issue.fixable === true)
      .reduce((sum, issue) => sum + issue.count, 0);

    // Total drift issues (exclude info-level)
    const totalDriftIssues = Object.values(issuesByType)
      .filter(issue => issue.severity !== 'info')
      .reduce((sum, issue) => sum + issue.count, 0);

    const healthScore = jobs.length > 0
      ? Math.round(((jobs.length - fixableDriftCount) / jobs.length) * 100)
      : 100;

    return Response.json({
      total_jobs: jobs.length,
      total_visits: visits.length,
      v2_execution_count: v2ExecutionCount,
      v1_legacy_count: v1LegacyCount,
      drift_issues_count: totalDriftIssues,
      fixable_drift_count: fixableDriftCount,
      legacy_info_count: v1LegacyCount,
      health_score: healthScore,
      issues_by_type: issuesByType,
      analyzed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Model drift analysis error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});