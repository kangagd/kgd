import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Check if job is V2 enabled (mirrored from jobModelRules.js)
const isJobV2Enabled = (job) => {
  const CUTOFF_DATE = new Date('2026-01-16T00:00:00Z');
  const jobCreated = job.created_date ? new Date(job.created_date) : null;
  
  // Explicit version marker
  if (job.job_model_version === 'v2') return true;
  if (job.job_model_version === 'v1') return false;
  
  // Visit count indicator
  if (job.visit_count && job.visit_count > 0) return true;
  
  // Creation date heuristic
  if (jobCreated && jobCreated >= CUTOFF_DATE) return true;
  
  return false;
};

// Helper: Check if legacy sections should be hidden
const shouldHideLegacySections = (job) => {
  if (!isJobV2Enabled(job)) return false;
  
  // V2 jobs with execution (visit_count > 0) should hide legacy UI
  if (job.visit_count && job.visit_count > 0) return true;
  
  return false;
};

// Helper: Detect legacy fields in job data
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

    // Fetch all non-deleted jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      deleted_at: { $exists: false } 
    });

    // Fetch all visits for cross-reference
    const visits = await base44.asServiceRole.entities.Visit.list();
    const visitsByJobId = {};
    visits.forEach(v => {
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    });

    // Analysis
    let v2EnabledCount = 0;
    const issuesByType = {};
    
    for (const job of jobs) {
      const isV2 = isJobV2Enabled(job);
      const shouldHide = shouldHideLegacySections(job);
      const legacyFields = detectLegacyFields(job);
      const jobVisits = visitsByJobId[job.id] || [];
      
      if (isV2) v2EnabledCount++;
      
      // Issue Type 1: V2 enabled but has legacy data in Job
      if (isV2 && legacyFields.length > 0 && shouldHide) {
        const issueType = 'v2_with_legacy_fields';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'V2 jobs with legacy execution data still in Job record (should be in Visit)',
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `Has ${legacyFields.length} legacy fields: ${legacyFields.join(', ')}`
          });
        }
      }
      
      // Issue Type 2: V2 enabled with visit_count > 0 but no Visit records
      if (isV2 && job.visit_count > 0 && jobVisits.length === 0) {
        const issueType = 'missing_visit_records';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'Jobs with visit_count > 0 but no Visit records in database',
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `visit_count=${job.visit_count} but 0 Visit records found`
          });
        }
      }
      
      // Issue Type 3: V2 enabled but visit_count is null/0 despite having Visit records
      if (isV2 && (!job.visit_count || job.visit_count === 0) && jobVisits.length > 0) {
        const issueType = 'visit_count_mismatch';
        if (!issuesByType[issueType]) {
          issuesByType[issueType] = {
            count: 0,
            description: 'Jobs with Visit records but visit_count is null or 0',
            sample_jobs: []
          };
        }
        issuesByType[issueType].count++;
        if (issuesByType[issueType].sample_jobs.length < 10) {
          issuesByType[issueType].sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `Has ${jobVisits.length} Visit records but visit_count=${job.visit_count || 0}`
          });
        }
      }
    }

    const totalDriftIssues = Object.values(issuesByType).reduce((sum, issue) => sum + issue.count, 0);
    const healthScore = jobs.length > 0 ? Math.round(((jobs.length - totalDriftIssues) / jobs.length) * 100) : 100;

    return Response.json({
      total_jobs: jobs.length,
      v2_enabled_count: v2EnabledCount,
      drift_issues_count: totalDriftIssues,
      health_score: healthScore,
      issues_by_type: issuesByType,
      analyzed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Model drift analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});