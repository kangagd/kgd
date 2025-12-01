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