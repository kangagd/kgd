import { PROJECT_STAGES } from "./projectStages";
import { JOB_STATUS_OPTIONS } from "./jobConfig";

export const countProjectsByStage = (projects = []) => {
  const counts = projects.reduce((acc, project) => {
    const stage = project.status;
    if (stage) {
      acc[stage] = (acc[stage] || 0) + 1;
    }
    return acc;
  }, {});

  return PROJECT_STAGES.map(stage => ({
    stage,
    count: counts[stage] || 0
  }));
};

export const countJobsByStatus = (jobs = []) => {
  const counts = jobs.reduce((acc, job) => {
    const status = job.status;
    if (status) {
      acc[status] = (acc[status] || 0) + 1;
    }
    return acc;
  }, {});

  return JOB_STATUS_OPTIONS.map(status => ({
    status,
    count: counts[status] || 0
  }));
};

export const groupByMonth = (records = [], dateField) => {
  const groups = records.reduce((acc, record) => {
    const dateVal = record[dateField];
    if (!dateVal) return acc;

    try {
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return acc;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      acc[key] = (acc[key] || 0) + 1;
    } catch (e) {
      // ignore invalid dates
    }
    return acc;
  }, {});

  return Object.entries(groups)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

// Note: Using 'created_date' as it is the standard Base44 built-in attribute
export const getProjectCreatedByMonth = (projects) => groupByMonth(projects, "created_date");
export const getProjectCompletedByMonth = (projects) => groupByMonth(projects, "completed_date");

export const getJobCreatedByMonth = (jobs) => groupByMonth(jobs, "created_date");
export const getJobCompletedByMonth = (jobs) => groupByMonth(jobs, "completed_date");