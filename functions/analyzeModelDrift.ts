import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * Analyze-only model health:
 * - Reports legacy fields on Scheduled/Open jobs (no migration)
 * - Reports legacy fields on Completed jobs (no migration)
 * - Reports V2 drift issues (visit_count mismatch, missing visits, etc)
 *
 * Input:
 * {
 *   limit?: number (default 5000),
 *   jobIds?: string[] (optional)
 * }
 */
Deno.serve(async (req) => {
  const report = {
    success: false,
    total_jobs: 0,
    v2_enabled_count: 0,
    drift_issues_count: 0,
    health_score: 100,
    issues_by_type: {},
    analyzed_at: new Date().toISOString(),
    debug: {},
  };

  // ---------- helpers ----------
  const normaliseRecords = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.results)) return res.results;
    return [];
  };

  const toTs = (x) => {
    try {
      const t = new Date(x).getTime();
      return Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  };

  // Fetch all pages (list/filter pagination tolerant)
  const listAll = async (entity, filterObj = null, maxPages = 200) => {
    const out = [];
    let cursor = null;

    for (let i = 0; i < maxPages; i++) {
      const page = filterObj
        ? await entity.filter({ ...filterObj, ...(cursor ? { cursor } : {}) }).catch(() => null)
        : await entity.list(cursor ? { cursor } : {}).catch(() => null);

      const items = normaliseRecords(page);
      out.push(...items);

      cursor = page?.next_cursor || page?.nextCursor || null;
      if (!cursor) break;
    }

    return out;
  };

  const normaliseStatus = (s) => (s || "").toString().trim().toLowerCase();
  const isCompletedStatus = (s) => {
    const v = normaliseStatus(s);
    return v === "completed" || v === "complete" || v === "done";
  };
  const isScheduledStatus = (s) => {
    const v = normaliseStatus(s);
    return v === "scheduled";
  };
  const isOpenishStatus = (s) => {
    const v = normaliseStatus(s);
    return v === "open" || v === "in progress" || v === "in_progress" || v === "pending";
  };

  // V2 enabled heuristic (your current logic)
  const isJobV2Enabled = (job) => {
    const CUTOFF_DATE = new Date("2026-01-16T00:00:00Z");
    const jobCreated = job.created_date ? new Date(job.created_date) : null;

    if (job.job_model_version === "v2") return true;
    if (job.job_model_version === "v1") return false;

    if (job.visit_count && job.visit_count > 0) return true;
    if (jobCreated && jobCreated >= CUTOFF_DATE) return true;

    return false;
  };

  const shouldHideLegacySections = (job) => {
    if (!isJobV2Enabled(job)) return false;
    if (job.visit_count && job.visit_count > 0) return true;
    return false;
  };

  const LEGACY_FIELDS = [
    "overview",
    "next_steps",
    "communication_with_client",
    "pricing_provided",
    "additional_info",
    "completion_notes",
  ];

  const detectLegacyFields = (job) => {
    const legacyFields = [];
    for (const field of LEGACY_FIELDS) {
      const v = job?.[field];
      if (typeof v === "string" && v.trim()) legacyFields.push(field);
    }
    return legacyFields;
  };

  const pushIssue = (issuesByType, issueType, description, sample, maxSamples = 10) => {
    if (!issuesByType[issueType]) {
      issuesByType[issueType] = { count: 0, description, sample_jobs: [] };
    }
    issuesByType[issueType].count++;
    if (issuesByType[issueType].sample_jobs.length < maxSamples) {
      issuesByType[issueType].sample_jobs.push(sample);
    }
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN ONLY
    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.min(20000, body.limit)) : 5000;
    const jobIds = Array.isArray(body?.jobIds) ? body.jobIds.filter(Boolean) : null;

    const Job = base44.asServiceRole.entities.Job;
    const Visit = base44.asServiceRole.entities.Visit;

    // 1) Fetch jobs robustly (do not rely on $exists)
    let jobs = [];

    if (jobIds && jobIds.length) {
      for (const id of jobIds.slice(0, limit)) {
        const j = await Job.get(id).catch(() => null);
        if (!j) continue;
        if (j.deleted_at) continue;
        jobs.push(j);
      }
    } else {
      // try deleted_at:null first, else list all and filter client-side
      let serverJobs = await listAll(Job, { deleted_at: null }).catch(() => []);
      if (!serverJobs || serverJobs.length === 0) {
        serverJobs = await listAll(Job, null).catch(() => []);
      }
      serverJobs = serverJobs.filter((j) => !j.deleted_at);
      report.debug.fetched_jobs_pre_limit = serverJobs.length;
      jobs = serverJobs.slice(0, limit);
    }

    report.total_jobs = jobs.length;

    // 2) Fetch visits (single pass)
    const visits = await listAll(Visit, null).catch(() => []);
    const visitsByJobId = {};
    for (const v of visits) {
      if (!v?.job_id) continue;
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    }

    // 3) Analyze
    const issuesByType = {};
    let v2EnabledCount = 0;

    // For health score, count only "true drift" issues (not scheduled legacy fields)
    const driftCountingTypes = new Set([
      "v2_with_legacy_fields",      // only when shouldHideLegacySections(job) === true
      "missing_visit_records",
      "visit_count_mismatch",
    ]);

    for (const job of jobs) {
      const isV2 = isJobV2Enabled(job);
      const shouldHide = shouldHideLegacySections(job);
      const legacyFields = detectLegacyFields(job);
      const jobVisits = visitsByJobId[job.id] || [];

      if (isV2) v2EnabledCount++;

      // ---- NEW: report legacy fields on Scheduled/Open jobs (NO FIX) ----
      // ONLY flag if job is explicitly V2 (has visit_count > 0) and still using legacy fields
      if (legacyFields.length > 0) {
        const status = job.status || "unknown";

        if ((isScheduledStatus(status) || isOpenishStatus(status) || (!isCompletedStatus(status) && !shouldHide)) && shouldHide) {
          pushIssue(
            issuesByType,
            "scheduled_with_legacy_fields",
            "V2 jobs (visit_count > 0) that are not completed still have legacy fields. These should use Visit records instead.",
            {
              id: job.id,
              job_number: job.job_number,
              customer_name: job.customer_name,
              status: job.status,
              visit_count: job.visit_count || 0,
              job_model_version: job.job_model_version || null,
              issue_details: `Has legacy fields: ${legacyFields.join(", ")}`,
            }
          );
        }

        if (isCompletedStatus(status)) {
          pushIssue(
            issuesByType,
            "completed_with_legacy_fields",
            "Completed jobs contain legacy fields on Job. Migration may be appropriate only if Visit record is missing or empty.",
            {
              id: job.id,
              job_number: job.job_number,
              customer_name: job.customer_name,
              status: job.status,
              visit_count: job.visit_count || 0,
              job_model_version: job.job_model_version || null,
              visits_found: jobVisits.length,
              issue_details: `Has legacy fields: ${legacyFields.join(", ")}`,
            }
          );
        }
      }

      // ---- Existing: V2 drift issues ----

      // Issue Type 1: V2 enabled AND shouldHideLegacySections AND has legacy fields on Job
      if (isV2 && shouldHide && legacyFields.length > 0) {
        pushIssue(
          issuesByType,
          "v2_with_legacy_fields",
          "V2 jobs with execution (visit_count > 0) still have legacy execution fields on Job record (should live on Visit).",
          {
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `Has legacy fields: ${legacyFields.join(", ")}`,
          }
        );
      }

      // Issue Type 2: V2 enabled with visit_count > 0 but no Visit records
      if (isV2 && (job.visit_count || 0) > 0 && jobVisits.length === 0) {
        pushIssue(
          issuesByType,
          "missing_visit_records",
          "Jobs with visit_count > 0 but no Visit records in database.",
          {
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `visit_count=${job.visit_count} but 0 Visit records found`,
          }
        );
      }

      // Issue Type 3: V2 enabled but visit_count null/0 despite having Visit records
      if (isV2 && (!job.visit_count || job.visit_count === 0) && jobVisits.length > 0) {
        pushIssue(
          issuesByType,
          "visit_count_mismatch",
          "Jobs with Visit records but visit_count is null or 0.",
          {
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer_name,
            visit_count: job.visit_count || 0,
            job_model_version: job.job_model_version,
            status: job.status,
            issue_details: `Has ${jobVisits.length} Visit records but visit_count=${job.visit_count || 0}`,
          }
        );
      }
    }

    // Compute drift count + health score (exclude scheduled legacy noise)
    const driftIssuesCount = Object.entries(issuesByType).reduce((sum, [type, issue]) => {
      if (driftCountingTypes.has(type)) return sum + issue.count;
      return sum;
    }, 0);

    report.v2_enabled_count = v2EnabledCount;
    report.issues_by_type = issuesByType;
    report.drift_issues_count = driftIssuesCount;

    report.health_score =
      jobs.length > 0 ? Math.round(((jobs.length - driftIssuesCount) / jobs.length) * 100) : 100;

    report.success = true;
    return Response.json(report);
  } catch (error) {
    console.error("Model drift analysis error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});