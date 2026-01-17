import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * Backfill legacy execution data from Job -> Visit.
 *
 * SAFE RULES:
 * - Admin only
 * - dryRun supported
 * - Never overwrite non-empty Visit fields
 * - If Visit exists: only fill missing fields
 * - If no Visit exists: create a completed Visit
 * - Never delete legacy Job fields in this function
 * - Never change job_model_version
 */

const LEGACY_FIELDS = [
  "overview",
  "next_steps",
  "communication_with_client",
  "pricing_provided",
  "additional_info",
  "completion_notes",
  "outcome",
  "image_urls",
  "other_documents",
  "measurements",
];

function isNonEmpty(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function collectLegacy(job) {
  const present = [];
  for (const f of LEGACY_FIELDS) {
    if (isNonEmpty(job?.[f])) present.push(f);
  }
  return present;
}

function nowIso() {
  return new Date().toISOString();
}

function safeDateOnly(isoOrDateString) {
  try {
    const d = isoOrDateString ? new Date(isoOrDateString) : new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return safeDateOnly(null);
  }
}

function normaliseRecords(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

async function listAll(entity, filterObj, pageSize = 200, maxPages = 200) {
  const all = [];
  let offset = 0;

  for (let i = 0; i < maxPages; i++) {
    let res;
    try {
      res = await entity.filter(filterObj, { limit: pageSize, offset });
    } catch {
      res = await entity.filter(filterObj);
    }

    const records = normaliseRecords(res);
    all.push(...records);

    // if pagination unsupported or exhausted
    if (!records || records.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Choose primary Visit to backfill into.
 * Preference:
 * 1) latest completed
 * 2) latest by date/created_at
 */
function pickPrimaryVisit(visits = []) {
  if (!visits.length) return null;

  const completed = visits.filter(v => String(v?.status || "").toLowerCase() === "completed");
  const pool = completed.length ? completed : visits;

  const toTs = (v) => {
    const d = v?.date || v?.completed_at || v?.updated_at || v?.created_at;
    const t = d ? new Date(d).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };

  return [...pool].sort((a, b) => toTs(b) - toTs(a))[0] || null;
}

/**
 * Map legacy Job fields into Visit fields (adjust names here if needed).
 * IMPORTANT: Only used to fill EMPTY Visit fields.
 */
function buildVisitBackfillFromJob(job) {
  const attachments = [
    ...(Array.isArray(job.image_urls) ? job.image_urls.filter(Boolean) : []),
    ...(Array.isArray(job.other_documents) ? job.other_documents.filter(Boolean) : []),
  ];

  return {
    work_performed: job.overview || "",
    next_steps: job.next_steps || "",
    communication: job.communication_with_client || "",
    completion_notes: job.completion_notes || "",
    outcome: job.outcome || null,
    measurements: job.measurements || null,
    attachments,
    pricing_notes: job.pricing_provided || "",
    issues_found: job.additional_info || "",
    resolution: "", // keep blank unless you have a real legacy split
  };
}

/**
 * Only set fields that are currently empty on Visit.
 */
function computeVisitPatch(visit, backfill) {
  const patch = {};
  for (const [key, val] of Object.entries(backfill)) {
    const current = visit?.[key];

    // attachments: treat empty array as empty
    if (key === "attachments") {
      const curArr = Array.isArray(current) ? current.filter(Boolean) : [];
      const nextArr = Array.isArray(val) ? val.filter(Boolean) : [];
      if (curArr.length === 0 && nextArr.length > 0) patch[key] = nextArr;
      continue;
    }

    if (!isNonEmpty(current) && isNonEmpty(val)) {
      patch[key] = val;
    }
  }

  // Traceability, only if not already present
  const existingNotes = typeof visit?.notes === "string" ? visit.notes : "";
  if (!existingNotes.includes("legacy_backfill_v2")) {
    patch.notes = `${existingNotes ? existingNotes + "\n" : ""}legacy_backfill_v2: filled missing fields from Job at ${nowIso()}`;
  }
  if (!visit?.source_tag) patch.source_tag = "legacy_backfill_v2";

  return patch;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const {
      dryRun = true,
      limit = 500,
      onlyCompleted = true,
      reconcileVisitCount = true,
      jobIds = null, // optional explicit list
    } = payload || {};

    const Job = base44.asServiceRole.entities.Job;
    const Visit = base44.asServiceRole.entities.Visit;

    if (!Job || !Visit) {
      return Response.json({ error: "Missing Job or Visit entity" }, { status: 500 });
    }

    // Load candidate jobs (robust against Base44 filter quirks)
let jobs = [];

const normaliseStatus = (s) => (s || "").toString().trim().toLowerCase();
const isCompletedStatus = (s) => {
  const v = normaliseStatus(s);
  return v === "completed" || v === "complete" || v === "done" || v === "paid"; // conservative aliases
};

const isNotDeleted = (j) => !j?.deleted_at; // works if null/undefined/empty

if (Array.isArray(jobIds) && jobIds.length) {
  for (const id of jobIds.slice(0, limit)) {
    const j = await Job.get(id).catch(() => null);
    if (j && isNotDeleted(j)) jobs.push(j);
  }
} else {
  // Try server-side filter first (best)
  let serverJobs = [];
  try {
    // Avoid $exists: false (often unreliable). Prefer null/empty check.
    serverJobs = await listAll(Job, { deleted_at: null });
  } catch (e1) {
    try {
      // Some backends treat undefined same as null
      serverJobs = await listAll(Job, {});
    } catch (e2) {
      serverJobs = [];
    }
  }

  // If server-side produced nothing, fall back to list() and filter client-side
  if (!serverJobs || serverJobs.length === 0) {
    const res = await Job.list().catch(() => []);
    serverJobs = normaliseRecords(res);
  }

  // Enforce not-deleted + completed (optional)
  jobs = serverJobs.filter(j => isNotDeleted(j));
  if (onlyCompleted) jobs = jobs.filter(j => isCompletedStatus(j.status));

  jobs = jobs.slice(0, limit);
}

// Add debug
report.debug = report.debug || {};
report.debug.onlyCompleted = onlyCompleted;
report.debug.limit = limit;
report.debug.total_jobs_after_filters = jobs.length;


    // Group visits by job
    const visits = await listAll(Visit, { deleted_at: { $exists: false } }).catch(() => []);
    const visitsByJobId = {};
    for (const v of visits) {
      if (!v?.job_id) continue;
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    }

    const report = {
      success: true,
      dryRun: !!dryRun,
      total_jobs_considered: jobs.length,
      candidates_with_legacy: 0,
      created_visits: 0,
      updated_visits: 0,
      updated_jobs: 0,
      skipped: {
        no_legacy_fields: 0,
        legacy_but_no_visit_patch_needed: 0,
        errors: 0,
      },
      samples: {
        created: [],
        updated: [],
        skipped: [],
        errors: [],
      },
      analyzed_at: nowIso(),
    };

    for (const job of jobs) {
      try {
        const legacyFields = collectLegacy(job);
        if (!legacyFields.length) {
          report.skipped.no_legacy_fields++;
          continue;
        }
        report.candidates_with_legacy++;

        const jobVisits = visitsByJobId[job.id] || [];
        const backfill = buildVisitBackfillFromJob(job);

        // If no visits, create one
        if (jobVisits.length === 0) {
          const visitDate =
            job.completed_at ||
            job.client_confirmed_at ||
            job.scheduled_date ||
            job.updated_at ||
            job.created_date ||
            nowIso();

          const payloadToCreate = {
            job_id: job.id,
            date: safeDateOnly(visitDate),
            status: "completed",
            ...backfill,
            source_tag: "legacy_backfill_v2",
            notes: `legacy_backfill_v2: created Visit from Job legacy fields at ${nowIso()}`,
          };

          if (!dryRun) {
            const created = await Visit.create(payloadToCreate);
            report.created_visits++;
            if (report.samples.created.length < 10) {
              report.samples.created.push({ job_id: job.id, job_number: job.job_number, visit_id: created?.id });
            }

            if (reconcileVisitCount) {
              const current = Number(job?.visit_count || 0);
              const next = Math.max(current, 1);
              if (next !== current) {
                await Job.update(job.id, { visit_count: next });
                report.updated_jobs++;
              }
            }
          } else {
            report.created_visits++;
            if (report.samples.created.length < 10) {
              report.samples.created.push({ job_id: job.id, job_number: job.job_number, would_create: true });
            }
          }

          continue;
        }

        // If visits exist: patch the primary visit ONLY where empty
        const primary = pickPrimaryVisit(jobVisits);
        if (!primary) {
          report.skipped.errors++;
          if (report.samples.errors.length < 10) {
            report.samples.errors.push({ job_id: job.id, job_number: job.job_number, error: "no_primary_visit" });
          }
          continue;
        }

        const patch = computeVisitPatch(primary, backfill);
        const patchKeys = Object.keys(patch);

        if (patchKeys.length === 0) {
          report.skipped.legacy_but_no_visit_patch_needed++;
          continue;
        }

        if (!dryRun) {
          await Visit.update(primary.id, patch);
          report.updated_visits++;
          if (report.samples.updated.length < 10) {
            report.samples.updated.push({
              job_id: job.id,
              job_number: job.job_number,
              visit_id: primary.id,
              patched_fields: patchKeys,
            });
          }

          if (reconcileVisitCount) {
            const current = Number(job?.visit_count || 0);
            const expected = Math.max(current, jobVisits.length);
            if (expected !== current) {
              await Job.update(job.id, { visit_count: expected });
              report.updated_jobs++;
            }
          }
        } else {
          report.updated_visits++;
          if (report.samples.updated.length < 10) {
            report.samples.updated.push({
              job_id: job.id,
              job_number: job.job_number,
              visit_id: primary.id,
              would_patch_fields: patchKeys,
            });
          }
        }
      } catch (e) {
        report.skipped.errors++;
        if (report.samples.errors.length < 10) {
          report.samples.errors.push({
            job_id: job?.id,
            job_number: job?.job_number,
            error: e?.message || String(e),
          });
        }
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error("[backfillLegacyToVisits] Error:", error);
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});