import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * Backfill legacy Job execution fields into the Visit model for historical COMPLETED jobs.
 *
 * SAFETY PRINCIPLES
 * - Admin-only
 * - Dry-run by default
 * - Idempotent: do not create duplicate "backfilled" visits
 * - Never overwrite existing Visit data
 * - Never delete legacy Job fields (optional cleanup is separate and disabled by default)
 * - Never change job_model_version or other Job fields beyond optional visit_count reconciliation
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
  // Returns YYYY-MM-DD
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

async function listAllEntities(entity, filterObj, pageSize = 200) {
  // Base44 list/filter shapes vary, so we do simple pagination by repeatedly calling filter with limit/offset when available.
  // If your Base44 SDK does not support offset, it will still return first page; this is still safe for smaller datasets.
  const all = [];
  let offset = 0;

  for (let i = 0; i < 1000; i++) {
    let res;
    try {
      res = await entity.filter(filterObj, { limit: pageSize, offset });
    } catch (e) {
      // Fallback: some SDKs only accept one argument
      res = await entity.filter(filterObj);
    }

    const records = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.results)
      ? res.results
      : Array.isArray(res?.items)
      ? res.items
      : [];

    all.push(...records);

    // If pagination isn't supported, break after first pull.
    if (!records || records.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ADMIN ONLY
    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const {
      dryRun = true,
      // filters
      onlyCompleted = true,
      limit = 500,
      jobIds = null, // optional explicit array of job IDs
      // behavior flags
      reconcileVisitCount = true,
      // legacy cleanup is intentionally disabled by default
      clearLegacyFieldsAfterBackfill = false,
    } = payload || {};

    if (clearLegacyFieldsAfterBackfill) {
      // Hard stop guardrail: accidental destructive migration
      return Response.json(
        {
          error:
            "clearLegacyFieldsAfterBackfill is DISALLOWED in this function. Do cleanup as a separate explicit migration step.",
        },
        { status: 400 }
      );
    }

    const Job = base44.asServiceRole.entities.Job;
    const Visit = base44.asServiceRole.entities.Visit;

    if (!Job || !Visit) {
      return Response.json(
        { error: "Missing required entities: Job and/or Visit not available" },
        { status: 500 }
      );
    }

    // 1) Select candidate jobs
    let jobs = [];
    if (Array.isArray(jobIds) && jobIds.length > 0) {
      // Explicit set
      for (const id of jobIds.slice(0, limit)) {
        const j = await Job.get(id).catch(() => null);
        if (j && !j.deleted_at) jobs.push(j);
      }
    } else {
      const filterObj = {
        deleted_at: { $exists: false },
        ...(onlyCompleted ? { status: "Completed" } : {}),
      };

      jobs = await listAllEntities(Job, filterObj);
      jobs = jobs.slice(0, limit);
    }

    // 2) Load visits once (group by job_id) to ensure idempotency
    const allVisits = await listAllEntities(Visit, { deleted_at: { $exists: false } }).catch(() => []);
    const visitsByJob = {};
    for (const v of allVisits) {
      if (!v?.job_id) continue;
      if (!visitsByJob[v.job_id]) visitsByJob[v.job_id] = [];
      visitsByJob[v.job_id].push(v);
    }

    // 3) Backfill plan
    const planned = [];
    const skipped = [];
    const warnings = [];

    for (const job of jobs) {
      const legacyFields = collectLegacy(job);

      if (legacyFields.length === 0) {
        skipped.push({
          job_id: job.id,
          job_number: job.job_number,
          reason: "no_legacy_fields_present",
        });
        continue;
      }

      const jobVisits = visitsByJob[job.id] || [];

      // Idempotency key:
      // We treat a "backfilled" visit as any Visit with:
      // - job_id = job.id
      // - source_tag === "legacy_backfill_v1"
      // OR notes containing "legacy_backfill_v1"
      const alreadyBackfilled = jobVisits.some(
        (v) => v?.source_tag === "legacy_backfill_v1" || (typeof v?.notes === "string" && v.notes.includes("legacy_backfill_v1"))
      );

      if (alreadyBackfilled) {
        skipped.push({
          job_id: job.id,
          job_number: job.job_number,
          reason: "already_backfilled",
          legacy_fields: legacyFields,
        });
        continue;
      }

      // If job has visits already, we DO NOT overwrite them.
      // We only backfill if there are NO visits, or if visits exist but none appear to contain execution fields
      // (this is conservative and avoids creating duplicates).
      const hasAnyVisits = jobVisits.length > 0;
      if (hasAnyVisits) {
        // Conservative skip: you can override by passing jobIds explicitly if needed
        skipped.push({
          job_id: job.id,
          job_number: job.job_number,
          reason: "has_existing_visits_skip_conservative",
          visit_count: jobVisits.length,
          legacy_fields: legacyFields,
        });
        continue;
      }

      // Build Visit payload WITHOUT overwriting rules (new record only)
      const visitDate =
        job.completed_at || job.client_confirmed_at || job.scheduled_date || job.updated_at || job.created_date || nowIso();

      const visitPayload = {
        job_id: job.id,
        // If Visit schema expects date-only:
        date: safeDateOnly(visitDate),
        status: "completed",
        // Standardized fields (adjust to your Visit schema as needed)
        work_performed: job.overview || "",
        next_steps: job.next_steps || "",
        communication: job.communication_with_client || "",
        completion_notes: job.completion_notes || "",
        outcome: job.outcome || null,
        measurements: job.measurements || null,
        // Attachments: combine image_urls + other_documents into one array
        attachments: [
          ...(Array.isArray(job.image_urls) ? job.image_urls.filter(Boolean) : []),
          ...(Array.isArray(job.other_documents) ? job.other_documents.filter(Boolean) : []),
        ],
        // Store pricing in a safe text field (if Visit has no pricing field)
        pricing_notes: job.pricing_provided || "",
        // Store any extra info safely
        issues_found: job.additional_info || "",
        resolution: "", // legacy model doesn't split this reliably; keep blank unless you have a field
        // Traceability
        source_tag: "legacy_backfill_v1",
        notes: `legacy_backfill_v1: migrated legacy fields from Job into Visit at ${nowIso()}`,
      };

      planned.push({
        job_id: job.id,
        job_number: job.job_number,
        customer_name: job.customer_name,
        legacy_fields: legacyFields,
        visit_to_create: visitPayload,
        reconcile_visit_count: reconcileVisitCount,
      });
    }

    // 4) Execute (or dry run)
    const created = [];
    const updatedJobs = [];

    if (!dryRun) {
      for (const item of planned) {
        // Create visit
        const createdVisit = await Visit.create(item.visit_to_create);

        created.push({
          job_id: item.job_id,
          job_number: item.job_number,
          visit_id: createdVisit?.id,
        });

        // Optionally reconcile visit_count, but do not alter anything else
        if (reconcileVisitCount) {
          try {
            const job = await Job.get(item.job_id);
            const current = Number(job?.visit_count || 0);
            const next = Math.max(current, 1);

            if (next !== current) {
              await Job.update(item.job_id, { visit_count: next });
              updatedJobs.push({
                job_id: item.job_id,
                job_number: item.job_number,
                visit_count_before: current,
                visit_count_after: next,
              });
            }
          } catch (e) {
            warnings.push({
              job_id: item.job_id,
              job_number: item.job_number,
              warning: "visit_count_reconcile_failed",
              detail: e?.message || String(e),
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      dryRun: !!dryRun,
      total_jobs_considered: jobs.length,
      planned_backfills: planned.length,
      created_visits: created.length,
      updated_jobs: updatedJobs.length,
      skipped_count: skipped.length,
      warnings_count: warnings.length,
      planned: dryRun ? planned.slice(0, 50) : undefined, // keep response size sane
      created,
      updatedJobs,
      skipped: skipped.slice(0, 50),
      warnings: warnings.slice(0, 50),
      analyzed_at: nowIso(),
      guardrails: {
        admin_only: true,
        never_overwrite_visits: true,
        never_delete_legacy_fields: true,
        conservative_skip_if_visits_exist: true,
        idempotent_source_tag: "legacy_backfill_v1",
      },
    });
  } catch (error) {
    console.error("[backfillLegacyJobsToVisits] Error:", error);
    return Response.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
});