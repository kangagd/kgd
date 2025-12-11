export const JOB_STATUS = {
  OPEN: "Open",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const JOB_STATUS_OPTIONS = Object.values(JOB_STATUS);

export const JOB_OUTCOME = {
  COMPLETED: "completed",
  SEND_INVOICE: "send_invoice",
  RETURN_VISIT_REQUIRED: "return_visit_required",
  LOST: "lost",
};

export const JOB_OUTCOME_OPTIONS = Object.values(JOB_OUTCOME);

export const JOB_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

export const JOB_PRIORITY_OPTIONS = Object.values(JOB_PRIORITY);

// Sample Logistics Job Types
export const SAMPLE_JOB_TYPES = {
  SAMPLE_DROP_OFF: "Sample Drop-Off",
  SAMPLE_PICKUP: "Sample Pickup",
};

export const SAMPLE_JOB_TYPE_OPTIONS = Object.values(SAMPLE_JOB_TYPES);

/**
 * Check if a job is a sample logistics job
 * @param {Object} job - Job object
 * @returns {boolean}
 */
export function isSampleLogisticsJob(job) {
  const jobTypeName = (job.job_type_name || job.job_type || '').toLowerCase();
  return jobTypeName.includes('sample') && (jobTypeName.includes('drop') || jobTypeName.includes('pickup'));
}