import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const LEGACY_FIELDS = [
  "overview",
  "next_steps",
  "communication_with_client",
  "pricing_provided",
  "additional_info",
  "completion_notes",
];

const hasAnyLegacy = (job) => {
  const present = [];
  for (const f of LEGACY_FIELDS) {
    const v = job?.[f];
    if (typeof v === "string" && v.trim()) present.push(f);
  }
  return present;
};

const safeString = (v) => (typeof v === "string" ? v.trim() : "");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== "admin") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Accept both formats
    const dryRun =
      body?.dry_run ?? body?.dryRun ?? true;

    const onlyCompleted =
      body?.only_completed ?? body?.onlyCompleted ?? true;

    // NEW: allow scheduled jobs analysis/backfill if you choose
    const includeScheduled =
      body?.include_scheduled ?? body?.includeScheduled ?? false;

    // NEW: optional cleanup (CLEAR legacy fields on Job) - OFF by default
    const cleanupLegacyFields =
      body?.cleanup_legacy_fields ?? body?.cleanupLegacyFields ?? false;

    // HARD SAFETY: never do cleanup unless explicitly enabled AND dryRun=false
    if (!dryRun && cleanupLegacyFields !== true) {
      // Allowed: create visits without cleanup
      // (If you want to block writes entirely unless a feature flag is passed, add that here)
    }

    // Pull jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({
      deleted_at: { $exists: false },
    });

    // Pull visits once to avoid N+1
    const visits = await base44.asServiceRole.entities.Visit.list();
    const visitsByJobId = {};
    for (const v of visits) {
      if (!v?.job_id) continue;
      if (!visitsByJobId[v.job_id]) visitsByJobId[v.job_id] = [];
      visitsByJobId[v.job_id].push(v);
    }

    let totalJobsConsidered = 0;
    let candidatesWithLegacy = 0;
    let createdVisits = 0;
    let updatedVisits = 0;
    let updatedJobs = 0;

    const skipped = {
      not_completed: 0,
      no_legacy_fields: 0,
      legacy_but_no_patch_needed: 0,
      no_job_found: 0,
      errors: 0,
    };

    const samples = { created: [], updated: [], skipped: [], errors: [] };

    for (const job of jobs) {
      try {
        const status = job?.status;
        const isCompleted = status === "Completed";
        const isScheduled = status === "Scheduled";

        if (onlyCompleted && !isCompleted) {
          skipped.not_completed++;
          continue;
        }

        if (!onlyCompleted && !includeScheduled && isScheduled) {
          // keep scheduled out unless explicitly included
          // (optional rule — remove if you want all non-deleted jobs)
        }

        totalJobsConsidered++;

        const legacyFields = hasAnyLegacy(job);
        if (legacyFields.length === 0) {
          skipped.no_legacy_fields++;
          continue;
        }

        candidatesWithLegacy++;

        const existingVisits = visitsByJobId[job.id] || [];
        const alreadyHasVisit = existingVisits.length > 0;

        // If no visit exists, create one from legacy fields
        if (!alreadyHasVisit) {
          const payload = {
            job_id: job.id,
            // if you have visit_number or visit_index fields in your Visit model, add them here
            overview: safeString(job.overview),
            next_steps: safeString(job.next_steps),
            communication: safeString(job.communication_with_client),
            pricing_notes: safeString(job.pricing_provided),
            additional_info: safeString(job.additional_info),
            completion_notes: safeString(job.completion_notes),
            source: "legacy_backfill",
          };

          if (!dryRun) {
            await base44.asServiceRole.entities.Visit.create(payload);
          }

          createdVisits++;
          if (samples.created.length < 10) {
            samples.created.push({
              id: job.id,
              job_number: job.job_number,
              legacy_fields: legacyFields,
              action: dryRun ? "would_create_visit" : "created_visit",
            });
          }

          // Update local cache so cleanup logic can run without re-query
          visitsByJobId[job.id] = [{ job_id: job.id, source: "legacy_backfill" }];
        } else {
          // Visit exists already - no patch needed
          skipped.legacy_but_no_patch_needed++;
        }

        // Optional cleanup: clear legacy fields on Job AFTER Visit exists
        const nowHasVisit = (visitsByJobId[job.id] || []).length > 0;

        if (cleanupLegacyFields === true && nowHasVisit) {
          const clearPayload = {};
          for (const f of LEGACY_FIELDS) clearPayload[f] = "";

          // optional marker so you can debug later
          clearPayload.legacy_migrated_to_visit_at = new Date().toISOString();

          if (!dryRun) {
            await base44.asServiceRole.entities.Job.update(job.id, clearPayload);
          }

          updatedJobs++;
        }
      } catch (err) {
        skipped.errors++;
        if (samples.errors.length < 10) {
          samples.errors.push({ job_id: job?.id, job_number: job?.job_number, error: String(err?.message || err) });
        }
      }
    }

    return Response.json({
      success: true,
      dryRun,
      onlyCompleted,
      includeScheduled,
      cleanupLegacyFields,
      total_jobs_considered: totalJobsConsidered,
      candidates_with_legacy: candidatesWithLegacy,
      created_visits: createdVisits,
      updated_visits: updatedVisits,
      updated_jobs: updatedJobs,
      skipped,
      samples,
      analyzed_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
