import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * analyzeModelDrift (READ-ONLY)
 * - Admin only
 * - Lists Jobs + Visits
 * - Detects drift between legacy Job execution fields vs Visit model
 * - SAFE: no writes
 */

// Helper: Check if job is V2 enabled (mirrored from jobModelRules.js)
const isJobV2Enabled = (job) => {
  const CUTOFF_DATE = new Date("2026-01-16T00:00:00Z");
  const jobCreated = job?.created_date ? new Date(job.created_date) : null;

  // Explicit version marker
  if (job?.job_model_version === "v2") return true;
  if (job?.job_model_version === "v1") return false;

  // Visit count indicator
  if (typeof job?.visit_count === "number" && job.visit_count > 0) return true;

  // Creation date heuristic
  if (jobCreated && !Number.isNaN(jobCreated.getTime()) && jobCreated >= CUTOFF_DATE) return true;

  return false;
};

// Helper: Should legacy UI be hidden (only for V2 jobs with execution)
const shouldHideLegacySections = (job) => {
  if (!isJobV2Enabled(job)) return false;
  if (typeof job?.visit_count === "number" && job.visit_count > 0) return true;
  return false;
};

// Helper: Detect legacy execution fields on Job record
const detectLegacyFields = (job) => {
  const legacyFields = [];
  const fieldsToCheck = [
    "overview",
    "next_steps",
    "communication_with_client",
    "pricing_provided",
    "additional_info",
    "completion_notes",
  ];

  for (const field of fieldsToCheck) {
    const v = job?.[field];
    if (typeof v === "string" && v.trim()) legacyFields.push(field);
    else if (v && typeof v !== "string") legacyFields.push(field); // defensive: unexpected types
  }

  return legacyFields;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN-ONLY
    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // SAFEST: list all and filter client-side (avoid $exists operator)
    const jobsAll = await base44.asServiceRole.entities.Job.list();
    const jobs = (jobsAll || []).filter((j) => !j?.deleted_at);

    // Visits: list all (monitor size in case it grows large)
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
    let v2EnabledCount = 0;
    const issuesByType = {};

    const ensureIssueBucket = (issueType, description) => {
      if (!issuesByType[issueType]) {
        issuesByType[issueType] = {
          count: 0,
          description,
          sample_jobs: [],
        };
      }
      return issuesByType[issueType];
    };

    for (const job of jobs) {
      const isV2 = isJobV2Enabled(job);
      const hideLegacy = shouldHideLegacySections(job);
      const legacyFields = detectLegacyFields(job);
      const jobVisits = visitsByJobId[job.id] || [];

      if (isV2) v2EnabledCount++;

      // Issue 1: V2 enabled AND has legacy execution fields on Job
      // (Important: DO NOT gate on hideLegacy; we want to detect drift even before visit_count > 0)
      if (isV2 && legacyFields.length > 0) {
        const bucket = ensureIssueBucket(
          "v2_with_legacy_fields",
          "V2 jobs still contain legacy execution fields on Job record (should live on Visit model where applicable)"
        );
        bucket.count++;
        if (bucket.sample_jobs.length < 10) {
          bucket.sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count ?? 0,
            job_model_version: job.job_model_version ?? null,
            status: job.status,
            hide_legacy_sections: hideLegacy,
            issue_details: `Has legacy fields: ${legacyFields.join(", ")}`,
          });
        }
      }

      // Issue 2: V2 enabled, visit_count > 0 but no Visit records
      if (isV2 && (job.visit_count || 0) > 0 && jobVisits.length === 0) {
        const bucket = ensureIssueBucket(
          "missing_visit_records",
          "Jobs with visit_count > 0 but no Visit records exist"
        );
        bucket.count++;
        if (bucket.sample_jobs.length < 10) {
          bucket.sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count ?? 0,
            job_model_version: job.job_model_version ?? null,
            status: job.status,
            hide_legacy_sections: hideLegacy,
            issue_details: `visit_count=${job.visit_count ?? 0} but 0 Visit records found`,
          });
        }
      }

      // Issue 3: V2 enabled, has Visit records but visit_count is null/0
      if (isV2 && (job.visit_count == null || job.visit_count === 0) && jobVisits.length > 0) {
        const bucket = ensureIssueBucket(
          "visit_count_mismatch",
          "Jobs have Visit records but visit_count is null/0 (counter drift)"
        );
        bucket.count++;
        if (bucket.sample_jobs.length < 10) {
          bucket.sample_jobs.push({
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count ?? 0,
            job_model_version: job.job_model_version ?? null,
            status: job.status,
            hide_legacy_sections: hideLegacy,
            issue_details: `Has ${jobVisits.length} Visit records but visit_count=${job.visit_count ?? 0}`,
          });
        }
      }
    }

    const totalDriftIssues = Object.values(issuesByType).reduce(
      (sum, issue) => sum + (issue?.count || 0),
      0
    );

    // Health score: "jobs without any detected issue type"
    // Note: This is a simplified metric (a job can count in multiple buckets).
    const healthScore =
      jobs.length > 0 ? Math.max(0, Math.min(100, Math.round(((jobs.length - totalDriftIssues) / jobs.length) * 100))) : 100;

    return Response.json({
      total_jobs: jobs.length,
      total_visits: visits.length,
      v2_enabled_count: v2EnabledCount,
      drift_issues_count: totalDriftIssues,
      health_score: healthScore,
      issues_by_type: issuesByType,
      analyzed_at: new Date().toISOString(),
      notes: {
        read_only: true,
        v2_detection: "job_model_version v2 OR visit_count>0 OR created_date>=2026-01-16",
        legacy_hide_rule: "hide legacy UI only when V2 AND visit_count>0",
      },
    });
  } catch (error) {
    console.error("Model drift analysis error:", error);
    return Response.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
});
