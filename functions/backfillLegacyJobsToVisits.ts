import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * Backfill legacy execution fields stored on Job onto a Visit record.
 *
 * SAFE PRINCIPLES:
 * - COPY ONLY by default (does NOT clear Job fields)
 * - NEVER overwrite non-empty Visit fields
 * - Admin-only
 *
 * INPUTS (JSON body):
 * {
 *   dryRun?: boolean (default true),
 *   onlyCompleted?: boolean (default true),
 *   limit?: number (default 200),
 *   jobIds?: string[] (optional)
 * }
 */
Deno.serve(async (req) => {
  const report = {
    success: false,
    dryRun: true,
    onlyCompleted: true,
    total_jobs_considered: 0,
    candidates_with_legacy: 0,
    created_visits: 0,
    updated_visits: 0,
    updated_jobs: 0, // (copy-only so should remain 0 unless you later extend)
    skipped: {
      not_completed: 0,
      no_legacy_fields: 0,
      legacy_but_no_patch_needed: 0,
      no_job_found: 0,
      errors: 0,
    },
    samples: {
      created: [],
      updated: [],
      skipped: [],
      errors: [],
    },
    analyzed_at: new Date().toISOString(),
    debug: {},
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== undefined ? !!body.dryRun : true;
    const onlyCompleted = body?.onlyCompleted !== undefined ? !!body.onlyCompleted : true;
    const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.min(5000, body.limit)) : 200;
    const jobIds = Array.isArray(body?.jobIds) ? body.jobIds.filter(Boolean) : null;

    report.dryRun = dryRun;
    report.onlyCompleted = onlyCompleted;

    const Job = base44.asServiceRole.entities.Job;
    const Visit = base44.asServiceRole.entities.Visit;

    const LEGACY_FIELDS = [
      "overview",
      "next_steps",
      "communication_with_client",
      "pricing_provided",
      "additional_info",
      "completion_notes",
    ];

    const normaliseStatus = (s) => (s || "").toString().trim().toLowerCase();
    const isCompletedStatus = (s) => {
      const v = normaliseStatus(s);
      // allow some historical variants
      return v === "completed" || v === "complete" || v === "done";
    };

    const isNotDeleted = (j) => !j?.deleted_at; // works for null/undefined/empty

    const hasLegacy = (job) => {
      const found = [];
      for (const k of LEGACY_FIELDS) {
        const v = job?.[k];
        if (typeof v === "string" && v.trim()) found.push(k);
      }
      return found;
    };

    // Base44 list() / filter() can return different shapes — normalise
    const normaliseRecords = (res) => {
      if (!res) return [];
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    };

    // Fetch all pages if list/filter is paginated
    const listAll = async (entity, filterObj = null) => {
      const out = [];
      let cursor = null;

      for (let i = 0; i < 200; i++) {
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

    // 1) Load jobs robustly
    let jobs = [];

    if (jobIds && jobIds.length) {
      // Explicit IDs requested (safe + precise)
      for (const id of jobIds.slice(0, limit)) {
        const j = await Job.get(id).catch(() => null);
        if (!j) {
          report.skipped.no_job_found++;
          continue;
        }
        if (!isNotDeleted(j)) continue;
        jobs.push(j);
      }
    } else {
      // Prefer listAll without relying on $exists:false
      // Some environments won't match deleted_at:{ $exists:false } reliably.
      let serverJobs = [];

      // Try "deleted_at: null" first (common representation of not-deleted)
      serverJobs = await listAll(Job, { deleted_at: null }).catch(() => []);

      // If that gave nothing, fall back to "list all" and filter client-side
      if (!serverJobs || serverJobs.length === 0) {
        serverJobs = await listAll(Job, null).catch(() => []);
      }

      serverJobs = serverJobs.filter(isNotDeleted);

      if (onlyCompleted) {
        serverJobs = serverJobs.filter((j) => isCompletedStatus(j.status));
      }

      jobs = serverJobs.slice(0, limit);

      report.debug.fetched_jobs_pre_limit = serverJobs.length;
      report.debug.limit = limit;
    }

    report.total_jobs_considered = jobs.length;

    // 2) Load visits and group by job_id (single read for speed)
    const allVisits = await listAll(Visit, null).catch(() => []);
    const visitsByJobId = {};
    for (const v of allVisits) {
      if (!v?.job_id) continue;
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    }

    // helper: choose the "best" visit to patch (latest by date-ish)
    const toTs = (x) => {
      try {
        const t = new Date(x).getTime();
        return Number.isFinite(t) ? t : 0;
      } catch {
        return 0;
      }
    };

    const pickLatestVisit = (visits) => {
      if (!Array.isArray(visits) || visits.length === 0) return null;
      return [...visits].sort((a, b) => {
        const at = Math.max(toTs(a.updated_at), toTs(a.updated_date), toTs(a.created_at), toTs(a.created_date));
        const bt = Math.max(toTs(b.updated_at), toTs(b.updated_date), toTs(b.created_at), toTs(b.created_date));
        return bt - at;
      })[0];
    };

    // 3) Process jobs
    for (const job of jobs) {
      try {
        // If onlyCompleted=false, we may still skip non-completed jobs
        if (!isCompletedStatus(job.status)) {
          // if user asked onlyCompleted=false, we still don’t backfill visits for non-completed
          // (because execution fields on scheduled jobs shouldn’t be migrated)
          report.skipped.not_completed++;
          if (report.samples.skipped.length < 10) {
            report.samples.skipped.push({
              id: job.id,
              job_number: job.job_number,
              status: job.status,
              reason: "not_completed",
            });
          }
          continue;
        }

        const legacyFields = hasLegacy(job);
        if (legacyFields.length === 0) {
          report.skipped.no_legacy_fields++;
          continue;
        }

        report.candidates_with_legacy++;

        const jobVisits = visitsByJobId[job.id] || [];
        const latestVisit = pickLatestVisit(jobVisits);

        // Build patch payload using legacy fields
        const legacyPayload = {};
        for (const f of legacyFields) {
          legacyPayload[f] = job[f];
        }

        // Decide: create visit vs patch existing
        if (!latestVisit) {
          // Create a new Visit record for this job (COPY ONLY)
          const visitData = {
            job_id: job.id,
            project_id: job.project_id || null,
            customer_id: job.customer_id || null,

            // best-effort visit date/time from job scheduling
            date: job.scheduled_date || null,
            time: job.scheduled_time || null,

            // legacy execution fields copied over:
            ...legacyPayload,
          };

          if (!dryRun) {
            await base44.asServiceRole.entities.Visit.create(visitData);
          }

          report.created_visits++;
          if (report.samples.created.length < 10) {
            report.samples.created.push({
              id: job.id,
              job_number: job.job_number,
              legacy_fields: legacyFields,
              action: dryRun ? "would_create_visit" : "created_visit",
            });
          }

          continue;
        }

        // Patch existing visit only where visit fields are empty
        const patch = {};
        let patchCount = 0;

        for (const f of legacyFields) {
          const existing = latestVisit?.[f];
          const existingHasValue = typeof existing === "string" && existing.trim();
          const jobHasValue = typeof job?.[f] === "string" && job[f].trim();

          if (!existingHasValue && jobHasValue) {
            patch[f] = job[f];
            patchCount++;
          }
        }

        if (patchCount === 0) {
          report.skipped.legacy_but_no_patch_needed++;
          continue;
        }

        if (!dryRun) {
          await base44.asServiceRole.entities.Visit.update(latestVisit.id, patch);
        }

        report.updated_visits++;
        if (report.samples.updated.length < 10) {
          report.samples.updated.push({
            id: job.id,
            job_number: job.job_number,
            visit_id: latestVisit.id,
            patched_fields: Object.keys(patch),
            action: dryRun ? "would_patch_visit" : "patched_visit",
          });
        }
      } catch (eJob) {
        report.skipped.errors++;
        if (report.samples.errors.length < 10) {
          report.samples.errors.push({
            job_id: job?.id,
            job_number: job?.job_number,
            error: eJob?.message || String(eJob),
          });
        }
      }
    }

    report.success = true;
    return Response.json(report);
  } catch (error) {
    report.success = false;
    return Response.json({ error: error?.message || String(error), report }, { status: 500 });
  }
});
