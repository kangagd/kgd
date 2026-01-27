/**
 * Computes deterministic "what changed since last visit" bullets.
 * 
 * Input: current job, current project, prior visit (or null), visits array
 * Output: array of change bullets, or empty array if no prior visit
 */
export function computeVisitDelta(job, project, priorVisit, allVisits = []) {
  const bullets = [];

  // No prior visit: return empty or "unknowns" instead of nothing
  if (!priorVisit) {
    return [];
  }

  // Rule 1: Project description changed
  if (project?.description && priorVisit.project_description_snapshot !== project.description) {
    bullets.push("Project scope or description changed");
  }

  // Rule 2: Special requirements changed
  if (project?.special_requirements && priorVisit.special_requirements_snapshot !== project.special_requirements) {
    bullets.push("Special requirements updated");
  }

  // Rule 3: Measurements changed
  const priorMeasurements = priorVisit.measurements_json ? JSON.parse(priorVisit.measurements_json) : null;
  const currentMeasurements = job.current_measurements_json ? JSON.parse(job.current_measurements_json) : null;
  
  if (JSON.stringify(priorMeasurements) !== JSON.stringify(currentMeasurements)) {
    bullets.push("Measurements or dimensions changed");
  }

  // Rule 4: New project activities since last visit
  const priorVisitDate = new Date(priorVisit.created_date || priorVisit.check_in_time);
  const recentActivities = (allVisits || [])
    .filter(v => new Date(v.created_date || v.check_in_time) > priorVisitDate)
    .slice(0, 3);
  
  if (recentActivities.length > 0) {
    bullets.push(`${recentActivities.length} activity/activities recorded since last visit`);
  }

  // Rule 5: New customer email since last visit
  if (job.last_external_email_at && priorVisitDate < new Date(job.last_external_email_at)) {
    bullets.push("New customer email received since last visit");
  }

  // Rule 6: Quote status changed (if quote exists)
  if (priorVisit.quote_status_snapshot && job.quote_status && job.quote_status !== priorVisit.quote_status_snapshot) {
    bullets.push(`Quote status changed: ${priorVisit.quote_status_snapshot} → ${job.quote_status}`);
  }

  // Rule 7: Invoice/payment status changed
  if (priorVisit.invoice_status_snapshot && job.invoice_status && job.invoice_status !== priorVisit.invoice_status_snapshot) {
    bullets.push(`Payment status changed: ${priorVisit.invoice_status_snapshot} → ${job.invoice_status}`);
  }

  // Limit to 6 bullets, prioritize first ones
  return bullets.slice(0, 6);
}

/**
 * Extract snapshot fields from a visit for future delta comparison
 */
export function captureVisitSnapshot(job, project) {
  return {
    project_description_snapshot: project?.description || null,
    special_requirements_snapshot: project?.special_requirements || null,
    measurements_snapshot: job?.current_measurements_json || null,
    quote_status_snapshot: job?.quote_status || null,
    invoice_status_snapshot: job?.invoice_status || null
  };
}