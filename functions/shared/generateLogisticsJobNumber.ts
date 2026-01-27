import { getPurposeCode, buildLogisticsJobNumber, getNextSequence } from "./logisticsJobNumbering.js";

export async function generateLogisticsJobNumber(base44, { project_id, project_number, logistics_purpose, job_id_for_fallback }) {
  const purposeCode = getPurposeCode(logistics_purpose);

  // Resolve project_number if missing
  let projectNumber = project_number || null;
  if (!projectNumber && project_id) {
    const project = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
    if (project?.project_number) projectNumber = String(project.project_number);
  }

  // If we have a project number, sequence per project + purpose
  if (projectNumber) {
    const existing = await base44.asServiceRole.entities.Job.filter({
      is_logistics_job: true,
      project_id,
      logistics_purpose
    });

    const seq = getNextSequence(existing, projectNumber, purposeCode);
    return buildLogisticsJobNumber({ projectNumber, purposeCode, sequence: seq });
  }

  // No project → fallback short id
  const fallbackShortId = (job_id_for_fallback || "").toString().slice(0, 6) || Math.random().toString(36).slice(2, 8);
  return buildLogisticsJobNumber({ projectNumber: null, purposeCode, fallbackShortId });
}