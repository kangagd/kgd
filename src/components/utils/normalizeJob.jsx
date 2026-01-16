/**
 * Normalize job data with safe defaults and field fallbacks
 * @param {Object} job - Job entity
 * @returns {Object} Normalized job object with safe defaults
 */
export function normalizeJob(job = {}) {
  if (!job || typeof job !== 'object') {
    job = {};
  }

  // Ensure assigned_to is always an array
  let assigned_to = [];
  if (Array.isArray(job.assigned_to)) {
    assigned_to = job.assigned_to;
  } else if (typeof job.assigned_to === 'string') {
    assigned_to = [job.assigned_to];
  }

  // Ensure assigned_to_name is always an array
  let assigned_to_name = [];
  if (Array.isArray(job.assigned_to_name)) {
    assigned_to_name = job.assigned_to_name;
  } else if (typeof job.assigned_to_name === 'string') {
    assigned_to_name = [job.assigned_to_name];
  }

  // Build assigned_technicians_display by zipping assigned_to and assigned_to_name
  // CRITICAL: Use assigned_to only (emails), no fallback to email local-part
  const assigned_technicians_display = assigned_to.map((email, idx) => ({
    email: email || '',
    name: assigned_to_name[idx] || ''
  }));

  // Derive project_label
  let project_label = '';
  if (job.project_name) {
    project_label = job.project_name;
  } else if (job.project_number) {
    project_label = `Project #${job.project_number}`;
  }

  return {
    // Spread original fields first
    ...job,
    // Then override with normalized values
    job_number: job.job_number || '',
    customer_name: job.customer_name || job.import_customer_name_raw || 'Unknown customer',
    project_label,
    address_display: job.address_full || job.address || '',
    assigned_to,
    assigned_to_name,
    assigned_technicians_display,
    scheduled_date: job.scheduled_date ? String(job.scheduled_date) : '',
    scheduled_time: job.scheduled_time ? String(job.scheduled_time) : ''
  };
}