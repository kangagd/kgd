import { base44 } from "@/api/base44Client";

export async function generateHandoverReportPdf(handover) {
  if (!handover) return null;

  // 1) Fetch the anchor project
  let project = null;
  if (handover.project_id) {
    try {
      project = await base44.entities.Project.get(handover.project_id);
    } catch (e) {
      console.error("Failed to load project for handover", e);
    }
  }

  // 2) Fetch the installation job (optional)
  let installJob = null;
  if (handover.job_id) {
    try {
      installJob = await base44.entities.Job.get(handover.job_id);
    } catch (e) {
      console.error("Failed to load install job for handover", e);
    }
  }

  // 3) Resolve core fields from project + install job + handover record

  const clientName =
    handover.client_name ||
    project?.client_name ||
    project?.contact_name ||
    "";

  const siteAddress =
    handover.site_address ||
    project?.site_address ||
    project?.address ||
    "";

  // Prefer explicit date on handover, then install job
  let dateOfWorks = handover.date_of_works || null;
  if (!dateOfWorks && installJob) {
    const dt = installJob.completed_at || installJob.date;
    if (dt) {
      // normalise to YYYY-MM-DD
      dateOfWorks = dt.slice(0, 10);
    }
  }

  // Prefer explicit technicians on handover, then install job
  let technicians = handover.technicians || "";
  if (!technicians && installJob) {
    if (Array.isArray(installJob.technicians) && installJob.technicians.length) {
      technicians = installJob.technicians
        .map((t) => t.name || t)
        .join(", ");
    } else if (installJob.technician_name) {
      technicians = installJob.technician_name;
    }
  }

  // Visit summary: prefer handover.work_completed, else install job notes
  let visitSummary = handover.work_completed || "";
  if (!visitSummary && installJob) {
    visitSummary = installJob.technician_notes || installJob.description || "";
  }

  // 4) Build a structured payload for the PDF generator
  const pdfPayload = {
    handover_id: handover.id,
    project: {
      id: project?.id || handover.project_id,
      name: project?.name || project?.project_name || "",
      client_name: clientName,
      site_address: siteAddress,
      reference: project?.reference || project?.job_number || project?.project_code || "",
    },
    installation_visit: {
      job_id: installJob?.id || handover.job_id || null,
      date_of_works: dateOfWorks,
      technicians,
      summary: visitSummary,
      job_type: installJob?.job_type || "",
    },
    report: {
      at_a_glance: null, // can be derived from work_completed / recommendations later
      what_we_did: visitSummary, // keeps it simple for now
      what_we_found: handover.cause_identified || "",
      what_happens_next: handover.recommendations || "",
      installed_products: handover.installed_products || "",
      manuals: handover.manuals || "",
      warranty_summary: handover.warranty_summary || "",
    },
  };

  // TODO: Plug this into a real PDF backend.
  // For now, just log the payload so we can inspect it while keeping a stub URL:
  console.log("HandoverReport pdfPayload", pdfPayload);

  // Stub URL so the app continues to work.
  // Later, replace this with an API call like:
  // const { url } = await base44.functions.generateHandoverPdf(pdfPayload);
  const fakeUrl = `https://example.com/handover-report-${handover.id || "preview"}.pdf`;
  return fakeUrl;
}